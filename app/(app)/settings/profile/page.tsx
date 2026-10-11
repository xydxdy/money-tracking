import { getProfile } from '@/app/actions/profile';
import { ProfileForms } from '@/components/profile-forms';

export default async function ProfilePage() {
  const profile = await getProfile();
  return <ProfileForms name={profile.name} email={profile.email} />;
}
