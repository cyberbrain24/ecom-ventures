# Universal CRUD & Delete Approval Mandate

## Mandatory Rule for Master Admin and Store Admin Panels

Whenever creating or modifying any module, resource, or feature in:
- Master Admin (`apps/master-admin`)
- Store Admin (`apps/store-admin`)

The AI Agent must strictly comply with the following architectural rules:

1. **Full CRUD Completeness**:
   - If an entity can be added/created, it **MUST** have a corresponding **Edit system** (e.g. `Edit<Entity>Modal`) and **Delete system**.
   - No entity may be created without simultaneous Edit and Delete capabilities.

2. **Delete Approval Popup Modal Requirement (NON-NEGOTIABLE)**:
   - **NEVER** delete any item directly on click.
   - **NEVER** use native browser `window.confirm()` or raw browser alerts.
   - **ALWAYS** display the branded approval confirmation modal (`ConfirmDeleteModal`):
     - In Master Admin: `import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';`
     - In Store Admin: `import { ConfirmDeleteModal } from './ConfirmDeleteModal';`
   - The approval popup modal must clearly state:
     - Specific item title / name being deleted
     - Entity type (e.g., Store Tenant, Catalog Product, Theme Blueprint, Domain Route, Customer Profile, Staff Account)
     - Explanatory warning regarding data impact
     - Explicit approval action button (`Confirm & Delete` with loading state during deletion)

3. **High-Density Compact Aesthetic**:
   - Modals and action buttons (Pencil for Edit, Trash2 for Delete) must adhere to the high-density compact design system, preserving minimal padding, crisp typography, and optimal spatial efficiency.
