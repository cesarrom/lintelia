'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/sign-on');
  }, [navigate]);

  return null;
};