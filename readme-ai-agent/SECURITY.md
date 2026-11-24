# Security & Data Constraints — Productivier

## 1. Authentication & Roles
- **Session**: Local persistent session token in `localStorage` (`prod_next_user`).
- **Roles**:
  - `admin`: Can create/delete team accounts, add new projects, and view monitoring metrics.
  - `karyawan`: Can submit daily realization, update personal profile, and view assigned projects.

## 2. Data Validation
- Passwords stored and validated through `/api/login`.
- Input fields enforce type constraints (number parsing for `target` and `realisasi`).
- SQL queries parameterized in `src/lib/db.ts` to prevent SQL Injection.
