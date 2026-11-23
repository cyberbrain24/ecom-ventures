package orders

import (
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrInvalidOrderTransition = errors.New("invalid order status transition")
	ErrOrderAlreadyTerminal   = errors.New("order is in a terminal state and cannot be modified")
)

// ValidOrderTransitions defines the directed acyclic graph of permissible status jumps across the 12-state machine.
var ValidOrderTransitions = map[storeModels.OrderStatus][]storeModels.OrderStatus{
	storeModels.OrderStatusPlaced: {
		storeModels.OrderStatusReview,
		storeModels.OrderStatusHold,
		storeModels.OrderStatusPending,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusReview: {
		storeModels.OrderStatusPending,
		storeModels.OrderStatusHold,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusHold: {
		storeModels.OrderStatusPending,
		storeModels.OrderStatusReview,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusPending: {
		storeModels.OrderStatusDelayed,
		storeModels.OrderStatusApprovalPending,
		storeModels.OrderStatusConfirmed,
		storeModels.OrderStatusProcessing,
		storeModels.OrderStatusShipped,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusDelayed: {
		storeModels.OrderStatusPending,
		storeModels.OrderStatusApprovalPending,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusApprovalPending: {
		storeModels.OrderStatusShipped,
		storeModels.OrderStatusDelivered,
		storeModels.OrderStatusPartiallyDelivered,
		storeModels.OrderStatusReturned,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusConfirmed: {
		storeModels.OrderStatusProcessing,
		storeModels.OrderStatusApprovalPending,
		storeModels.OrderStatusShipped,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusProcessing: {
		storeModels.OrderStatusApprovalPending,
		storeModels.OrderStatusShipped,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
	},
	storeModels.OrderStatusShipped: {
		storeModels.OrderStatusDelivered,
		storeModels.OrderStatusPartiallyDelivered,
		storeModels.OrderStatusReturned,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusManuallyCancelled,
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusDelivered: {
		storeModels.OrderStatusPartiallyDelivered,
		storeModels.OrderStatusReturned,
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusPartiallyDelivered: {
		storeModels.OrderStatusDelivered,
		storeModels.OrderStatusReturned,
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusReturned: {
		storeModels.OrderStatusManuallyCancelled,
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusCancelled:         {}, // Terminal state
	storeModels.OrderStatusManuallyCancelled: {}, // Terminal state
	storeModels.OrderStatusRefunded:          {}, // Terminal state
}

// ValidateOrderTransition asserts whether moving from currentStatus to targetStatus is permitted.
func ValidateOrderTransition(currentStatus, targetStatus storeModels.OrderStatus) error {
	if currentStatus == targetStatus {
		return fmt.Errorf("%w: order is already in state %s", ErrInvalidOrderTransition, currentStatus)
	}

	allowedNextStates, exists := ValidOrderTransitions[currentStatus]
	if !exists || len(allowedNextStates) == 0 {
		return fmt.Errorf("%w: cannot transition from terminal state %s", ErrOrderAlreadyTerminal, currentStatus)
	}

	for _, allowed := range allowedNextStates {
		if allowed == targetStatus {
			return nil
		}
	}

	return fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidOrderTransition, currentStatus, targetStatus)
}

// IsTerminalState checks if the status is final.
func IsTerminalState(status storeModels.OrderStatus) bool {
	return status == storeModels.OrderStatusCancelled || status == storeModels.OrderStatusRefunded
}
