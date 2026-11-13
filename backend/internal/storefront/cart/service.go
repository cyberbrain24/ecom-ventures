package cart

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// Service manages storefront cart interactions.
type Service struct {
	repo Repository
}

// NewService instantiates the cart service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetOrCreateCart retrieves an existing cart or initializes one for the session.
func (s *Service) GetOrCreateCart(ctx context.Context, sessionID string) (*CartDTO, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if sessionID == "" {
		sessionID = generateSessionID()
	}

	return s.repo.GetOrCreateCart(ctx, stCtx.TenantDB, sessionID, stCtx.Store.Currency)
}

// AddItem adds an item with inventory bounds validation.
func (s *Service) AddItem(ctx context.Context, sessionID string, req *AddCartItemRequest) (*CartDTO, error) {
	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	cart, err := s.GetOrCreateCart(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	stCtx, _ := storeCtx.FromContext(ctx)
	if err := s.repo.AddItem(ctx, stCtx.TenantDB, cart.ID, req.VariantID, req.Quantity); err != nil {
		return nil, err
	}

	return s.repo.GetCartBySession(ctx, stCtx.TenantDB, cart.SessionID)
}

// UpdateItemQuantity adjusts quantity on an existing cart line item.
func (s *Service) UpdateItemQuantity(ctx context.Context, sessionID, itemID string, quantity int) (*CartDTO, error) {
	cart, err := s.GetOrCreateCart(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	stCtx, _ := storeCtx.FromContext(ctx)
	if err := s.repo.UpdateItemQuantity(ctx, stCtx.TenantDB, cart.ID, itemID, quantity); err != nil {
		return nil, err
	}

	return s.repo.GetCartBySession(ctx, stCtx.TenantDB, cart.SessionID)
}

// RemoveItem removes a line item from the cart.
func (s *Service) RemoveItem(ctx context.Context, sessionID, itemID string) (*CartDTO, error) {
	cart, err := s.GetOrCreateCart(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	stCtx, _ := storeCtx.FromContext(ctx)
	if err := s.repo.RemoveItem(ctx, stCtx.TenantDB, cart.ID, itemID); err != nil {
		return nil, err
	}

	return s.repo.GetCartBySession(ctx, stCtx.TenantDB, cart.SessionID)
}

func generateSessionID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
