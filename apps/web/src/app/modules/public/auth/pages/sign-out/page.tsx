import { useEffect } from 'react';
import { useDescope } from '@descope/react-sdk';
import { useNavigate } from 'react-router';

export default function SignOutPage() {
  const navigate = useNavigate()
  const descope = useDescope();

  useEffect(() => {
    descope.logout();
    navigate('/sign-on');
  }, [descope, navigate]);

  return null;
}
