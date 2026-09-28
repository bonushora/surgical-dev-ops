# Production eligibility

Implementation availability, production configuration, operation eligibility,
and current authority are distinct states. Configuration may mark a canonical
repository eligible, but configuration, environment variables, profile
selection, process readiness, or a Control Plane approval reference cannot
authorize physical execution.

Only `READY_FOR_EXACT_PHYSICAL_OPERATION`, derived by Surgical DevOps for the
exact request with a successful final CAS, permits dispatch.
