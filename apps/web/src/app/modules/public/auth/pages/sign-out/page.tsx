import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthActions } from '@/lib/auth/session';

export default function SignOutPage() {
  const navigate = useNavigate();
  const { logout } = useAuthActions();

  useEffect(() => {
    void logout().then(() => navigate('/sign-on'));
  }, [logout, navigate]);

  return null;
}
