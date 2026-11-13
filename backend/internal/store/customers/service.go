package customers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	storeCtx "ecom-ventures/backend/internal/store/context"
	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/hasher"
)

// Service coordinates customer directory business logic and transactional address assignments.
type Service struct {
	repo   Repository
	hasher *hasher.Argon2idHasher
}

// NewService instantiates the customer service.
func NewService(repo Repository, h *hasher.Argon2idHasher) *Service {
	return &Service{
		repo:   repo,
		hasher: h,
	}
}

// CreateCustomer registers a new customer profile inside the active tenant database.
func (s *Service) CreateCustomer(ctx context.Context, req *CreateCustomerRequest) (*CustomerDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	if cleanEmail == "" {
		return nil, errors.New("customer email is required")
	}

	var passwordHash string
	if req.Password != nil && *req.Password != "" {
		hash, err := s.hasher.Hash(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		passwordHash = hash
	}

	c := &storeModels.Customer{
		Email:        cleanEmail,
		PasswordHash: passwordHash,
		FirstName:    strings.TrimSpace(req.FirstName),
		LastName:     strings.TrimSpace(req.LastName),
		Phone:        req.Phone,
		IsActive:     true,
	}

	if err := s.repo.CreateCustomer(ctx, stCtx.TenantDB, c); err != nil {
		return nil, err
	}

	return &CustomerDetailResponse{
		Customer:  *c,
		Metrics:   CustomerMetrics{},
		Addresses: []storeModels.CustomerAddress{},
	}, nil
}

// GetCustomer retrieves detailed customer profile, metrics, and address book.
func (s *Service) GetCustomer(ctx context.Context, id string) (*CustomerDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	c, err := s.repo.GetCustomerByID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return nil, err
	}

	metrics, err := s.repo.GetCustomerMetrics(ctx, stCtx.TenantDB, id)
	if err != nil {
		return nil, err
	}

	addresses, err := s.repo.ListAddressesByCustomerID(ctx, stCtx.TenantDB, id)
	if err != nil {
		return nil, err
	}
	if addresses == nil {
		addresses = []storeModels.CustomerAddress{}
	}

	return &CustomerDetailResponse{
		Customer:  *c,
		Metrics:   *metrics,
		Addresses: addresses,
	}, nil
}

// ListCustomers returns a paginated list of filtered customer summaries.
func (s *Service) ListCustomers(ctx context.Context, filter *CustomerFilterParams) (*PaginatedCustomersResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	customers, total, err := s.repo.ListCustomers(ctx, stCtx.TenantDB, filter)
	if err != nil {
		return nil, err
	}

	return &PaginatedCustomersResponse{
		Customers: customers,
		Total:     total,
		Page:      filter.Page,
		Limit:     filter.Limit,
	}, nil
}

// UpdateCustomer modifies mutable attributes on a customer profile.
func (s *Service) UpdateCustomer(ctx context.Context, id string, req *UpdateCustomerRequest) (*CustomerDetailResponse, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)

	if err := s.repo.UpdateCustomer(ctx, stCtx.TenantDB, id, req); err != nil {
		return nil, err
	}

	return s.GetCustomer(ctx, id)
}

// DeleteCustomer removes a customer record from the store.
func (s *Service) DeleteCustomer(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteCustomer(ctx, stCtx.TenantDB, id)
}

// AddAddress creates a new address entry, managing default flag promotions atomically.
func (s *Service) AddAddress(ctx context.Context, customerID string, req *AddressRequest) (*storeModels.CustomerAddress, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin address transaction: %w", err)
	}
	defer tx.Rollback()

	if req.IsDefaultShipping {
		if err := s.repo.ClearDefaultShipping(ctx, tx, customerID); err != nil {
			return nil, fmt.Errorf("failed to demote current default shipping: %w", err)
		}
	}
	if req.IsDefaultBilling {
		if err := s.repo.ClearDefaultBilling(ctx, tx, customerID); err != nil {
			return nil, fmt.Errorf("failed to demote current default billing: %w", err)
		}
	}

	addr := &storeModels.CustomerAddress{
		CustomerID:        customerID,
		Label:             strings.TrimSpace(req.Label),
		RecipientName:     strings.TrimSpace(req.RecipientName),
		Phone:             strings.TrimSpace(req.Phone),
		StreetAddress:     strings.TrimSpace(req.StreetAddress),
		ApartmentSuite:    req.ApartmentSuite,
		City:              strings.TrimSpace(req.City),
		StateProvince:     req.StateProvince,
		PostalCode:        req.PostalCode,
		Country:           strings.TrimSpace(req.Country),
		IsDefaultShipping: req.IsDefaultShipping,
		IsDefaultBilling:  req.IsDefaultBilling,
	}

	if err := s.repo.CreateAddress(ctx, stCtx.TenantDB, addr); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit address creation: %w", err)
	}

	return addr, nil
}

// UpdateAddress updates address details and handles default promotion.
func (s *Service) UpdateAddress(ctx context.Context, customerID, addressID string, req *AddressRequest) (*storeModels.CustomerAddress, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := stCtx.TenantDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if req.IsDefaultShipping {
		if err := s.repo.ClearDefaultShipping(ctx, tx, customerID); err != nil {
			return nil, err
		}
	}
	if req.IsDefaultBilling {
		if err := s.repo.ClearDefaultBilling(ctx, tx, customerID); err != nil {
			return nil, err
		}
	}

	if err := s.repo.UpdateAddress(ctx, stCtx.TenantDB, addressID, req); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit address update: %w", err)
	}

	return s.repo.GetAddressByID(ctx, stCtx.TenantDB, addressID)
}

// DeleteAddress deletes an address entry from the customer's address book.
func (s *Service) DeleteAddress(ctx context.Context, addressID string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteAddress(ctx, stCtx.TenantDB, addressID)
}
