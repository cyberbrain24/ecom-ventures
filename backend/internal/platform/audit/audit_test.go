package audit

import (
	"context"
	"database/sql"
	"errors"
	"net/http/httptest"
	"testing"
)

type fakeExec struct {
	query string
	args  []any
	err   error
}

func (f *fakeExec) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	f.query, f.args = query, args
	return nil, f.err
}

func TestIsUUID(t *testing.T) {
	if !IsUUID("00000000-0000-0000-0000-000000000001") {
		t.Error("expected canonical UUID to pass")
	}
	for _, s := range []string{"", "abc", "00000000-0000-0000-0000-00000000000g", "system"} {
		if IsUUID(s) {
			t.Errorf("%q must not be a UUID", s)
		}
	}
}

func TestRecordStoresNullUserForNonUUIDActor(t *testing.T) {
	f := &fakeExec{}
	err := Record(context.Background(), f, Actor{UserID: "system", Email: "ops@x.com", IP: "10.0.0.1"},
		"STORE_UPDATED", "stores", "id1", "", map[string]string{"a": "b"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	user, ok := f.args[0].(sql.NullString)
	if !ok || user.Valid {
		t.Errorf("non-UUID actor must produce a NULL user_id, got %#v", f.args[0])
	}
	if f.args[1] != "ops@x.com" || f.args[8] != "10.0.0.1" {
		t.Errorf("unexpected args %#v", f.args)
	}
	after, ok := f.args[7].(sql.NullString)
	if !ok || after.Valid {
		t.Errorf("nil payload must be NULL, got %#v", f.args[7])
	}
}

func TestRecordKeepsUUIDActorAndStore(t *testing.T) {
	const id = "00000000-0000-0000-0000-000000000001"
	f := &fakeExec{}
	if err := Record(context.Background(), f, Actor{UserID: id}, "X", "stores", "r", id, nil, map[string]int{"n": 1}); err != nil {
		t.Fatal(err)
	}
	if u := f.args[0].(sql.NullString); !u.Valid || u.String != id {
		t.Errorf("UUID actor must be kept: %#v", u)
	}
	if s := f.args[5].(sql.NullString); !s.Valid {
		t.Errorf("UUID store must be kept: %#v", s)
	}
	if ip := f.args[8]; ip != unknownClientIP {
		t.Errorf("empty IP must become %q, got %v", unknownClientIP, ip)
	}
}

func TestRecordPropagatesErrors(t *testing.T) {
	boom := errors.New("db down")
	if err := Record(context.Background(), &fakeExec{err: boom}, Actor{}, "X", "t", "r", "", nil, nil); !errors.Is(err, boom) {
		t.Errorf("expected wrapped db error, got %v", err)
	}
	if err := Record(context.Background(), nil, Actor{}, "X", "t", "r", "", nil, nil); err == nil {
		t.Error("expected error for nil executor")
	}
	if err := Record(context.Background(), &fakeExec{}, Actor{}, "X", "t", "r", "", make(chan int), nil); err == nil {
		t.Error("expected error for unencodable payload")
	}
}

func TestActorFromRequestWithoutClaims(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "203.0.113.9:5555"
	a := ActorFromRequest(req)
	if a.UserID != "" || a.IP != "203.0.113.9" {
		t.Errorf("unexpected actor %+v", a)
	}
}
