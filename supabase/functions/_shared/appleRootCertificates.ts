// Apple Server Verification task — pinned Apple root certificate(s).
//
// This is PUBLIC trust-anchor data, not a secret: Apple publishes these
// certificates for exactly this purpose (every third-party server that
// verifies App Store Server API/Notifications JWS data is expected to
// embed them) — see https://www.apple.com/certificateauthority/.
//
// Downloaded directly over HTTPS from
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer on
// 2026-09-16 and converted to PEM with `openssl x509 -inform DER
// -outform PEM`. SHA-256 fingerprint verified against the value
// independently published at
// https://support.apple.com/en-us/103100 (and equivalent per-OS-version
// pages) and https://ssl-tools.net: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:
// 3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79.
//
// This is the root that App Store Server API responses and App Store
// Server Notifications V2 payloads chain to today. Apple's own developer
// forum guidance (see docs/apple-subscription-implementation.md's Phase
// 1 compatibility note) says the root in a given response is not
// guaranteed to always be G3 specifically — if Apple ever signs with a
// different published root, `appleJwsVerification.ts`'s chain build will
// correctly fail closed (reject) until that new root is added here by a
// deliberate code change. This is a known, documented limitation, not a
// silent gap.
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

export const TRUSTED_APPLE_ROOT_CERTIFICATES_PEM = [APPLE_ROOT_CA_G3_PEM];
