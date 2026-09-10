/**
 * /amendments — retired.
 *
 * This route used to render four hand-written amendments with invented IS
 * numbers ("IS 616:2024 Amd.2", a steel Quality Control Order that does not
 * exist). It now redirects to /updates, which serves the Bureau's own What's
 * New feed. The route is kept rather than deleted because the dashboard, the
 * chat's navigation actions and any bookmark still point here.
 */

import { permanentRedirect } from "next/navigation";

export default function AmendmentsPage(): never {
  permanentRedirect("/updates");
}
