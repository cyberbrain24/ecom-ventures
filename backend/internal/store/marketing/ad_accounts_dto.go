package marketing

import "time"

// MetaAdAccount represents a connected Meta Marketing ad account.
type MetaAdAccount struct {
	ID            int        `json:"id"`
	Name          string     `json:"name"`
	MetaAccountID string     `json:"meta_account_id"`
	Currency      string     `json:"currency"`
	Timezone      string     `json:"timezone"`
	DailySpendCap float64    `json:"daily_spend_cap"`
	IsActive      bool       `json:"is_active"`
	IsTokenStored bool       `json:"is_token_stored"` // True if token is securely encrypted in DB (never returns raw token)
	LastSyncedAt  *time.Time `json:"last_synced_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// ConnectMetaAdAccountRequest is the payload to connect or update an ad account.
type ConnectMetaAdAccountRequest struct {
	Name          string  `json:"name"`
	MetaAccountID string  `json:"meta_account_id"`
	AccessToken   string  `json:"access_token"` // System User or User Access Token (EAAB...)
	Currency      string  `json:"currency"`
	Timezone      string  `json:"timezone"`
	DailySpendCap float64 `json:"daily_spend_cap"`
	IsActive      bool    `json:"is_active"`
}

// GraphAPIExplorerRequest is the payload for executing simulated or live graph queries.
type GraphAPIExplorerRequest struct {
	AdAccountID string `json:"ad_account_id"` // E.g. act_284910284019283
	Method      string `json:"method"`        // GET or POST
	Endpoint    string `json:"endpoint"`      // E.g. {ad_account_id}/insights?fields=spend,clicks...
	Body        string `json:"body,omitempty"`
}

// GraphAPIExplorerResponse holds the execution results of the test query.
type GraphAPIExplorerResponse struct {
	HTTPStatus     int                    `json:"http_status"`
	EndpointCalled string                 `json:"endpoint_called"`
	ExecutionMs    int64                  `json:"execution_ms"`
	Payload        map[string]interface{} `json:"payload"`
	ErrorMessage   string                 `json:"error_message,omitempty"`
}
