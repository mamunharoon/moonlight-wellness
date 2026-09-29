/* eslint-disable no-unused-vars */
import { ConfirmDialog } from './ConfirmDialog';
import { CONTACT_INFO } from '../lib/legalContent';

/*
 * WakeWise Phase 2A correction — the honest, manual "Download a copy of my
 * data" dialog, extracted out of AccountManagement.jsx so Profile.jsx's own
 * "Download a copy of my data" row can reuse the exact same wording rather
 * than a second, divergent copy of it. No behaviour change from the
 * original: still a single acknowledge-only dialog (no onConfirm), still
 * states plainly that automated export isn't built yet, still points to
 * the one real CONTACT_INFO.email rather than inventing an export
 * mechanism.
 */
export const DataExportDialog = ({ open, onDismiss }) => (
  <ConfirmDialog
    open={open}
    title="Download a copy of your data"
    message={`Automated data export isn't available in the app yet. Email us at ${CONTACT_INFO.email} from your account's email address and we'll prepare a copy for you.`}
    cancelLabel="Got it"
    onDismiss={onDismiss}
  />
);
