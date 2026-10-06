import { redirect } from 'next/navigation';

// Fusion Membres → Foyer (PRD : l'écran /household couvre nom du foyer,
// membres, invitation et départ) : /members redirige vers /household.
// Le layout PrivateRoute reste en place : sans session, la redirection
// vers /login (next=/members) est conservée par le middleware.
export default function MembersRedirect() {
  redirect('/household');
}
