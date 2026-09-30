# Client Components Layer (`client/src/components`)

## Structure & Conventions
Components are organized into responsibility subfolders:
- `dashboards/`: Role-specific view components (Department Admin, PMU Inspector, Institute Admin, State Authority, Beneficiary).
- `capture/`: Biometric check-in and camera capture components.
- `cctv/`: Real-time CCTV video feed player components.
- `vc/`: Video conference modal and call UI components.
- `common/`: Cross-cutting layout and utility components (e.g. ErrorBoundary).
- `ui/`: Design system primitive UI components (shadcn / Radix primitives).

## Rules
- Components must rely on props or custom hooks in `client/src/hooks/` and tRPC procedures via `@/lib/trpc`.
- Do NOT import server domain files directly into client components.
