import React from 'react';

/** Text shown on any control whose action has no backend endpoint yet. */
export const NOT_CONNECTED_TEXT = 'Not connected to the server yet';

/** Props for the banner shown above a section whose changes are not wired to the server. */
interface NotConnectedNoticeProps {
  /** Short description of what is not available, for example "Creating products". */
  what: string;
}

/**
 * Banner for a section whose create, edit, delete or toggle actions cannot run yet.
 * It states the limitation instead of letting a local-only change look saved.
 */
export const NotConnectedNotice: React.FC<NotConnectedNoticeProps> = ({ what }) => (
  <div className="notice notice-warning" role="status" style={{ marginBottom: '14px' }}>
    <strong>{NOT_CONNECTED_TEXT}.</strong> {what} cannot be saved from this screen yet.
  </div>
);

/** Props for the empty state shown when a list has no records from the server. */
interface EmptyStateProps {
  /** Message describing why the list is empty. */
  message: string;
}

/** Honest empty state for a list or table that has no records to show. */
export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <div className="notice-empty">{message}</div>
);
