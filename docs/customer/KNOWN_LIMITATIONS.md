# Known limitations

- Active in-flight atomic mutation cancellation is unsupported and remains
  `NON_INTERRUPTIBLE_MUTATION`.
- Universal power-loss immunity is not claimed beyond qualified platform
  primitives.
- Enterprise identity and complete segregation of duties are not qualified.
- External secret-store/KMS/HSM, SIEM, OpenTelemetry export, and artifact signing
  remain future boundaries.
- No push, merge, release, deploy, generic shell, arbitrary filesystem, or generic
  network authority exists.
- A graphical interface is not included; the CLI is the qualified surface.
