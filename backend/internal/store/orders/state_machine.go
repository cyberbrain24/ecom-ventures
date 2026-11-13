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

// ValidOrderTransitions defines the directed acyclic graph of permissible status jumps.
var ValidOrderTransitions = map[storeModels.OrderStatus][]storeModels.OrderStatus{
	storeModels.OrderStatusPending: {
		storeModels.OrderStatusConfirmed,
		storeModels.OrderStatusProcessing,
		storeModels.OrderStatusCancelled,
	},
	storeModels.OrderStatusConfirmed: {
		storeModels.OrderStatusProcessing,
		storeModels.OrderStatusCancelled,
	},
	storeModels.OrderStatusProcessing: {
		storeModels.OrderStatusShipped,
		storeModels.OrderStatusCancelled,
	},
	storeModels.OrderStatusShipped: {
		storeModels.OrderStatusDelivered,
		storeModels.OrderStatusCancelled,
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusDelivered: {
		storeModels.OrderStatusRefunded,
	},
	storeModels.OrderStatusCancelled: {}, // Terminal state
	storeModels.OrderStatusRefunded:  {}, // Terminal state
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
