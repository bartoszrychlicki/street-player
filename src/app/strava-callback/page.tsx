'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

function StravaCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Verifying...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Strava authorization failed');
      router.push('/');
      return;
    }

    if (!code) {
      // router.push('/'); // Don't redirect immediately on mount if params aren't ready? 
      // Actually searchParams should be ready. If no code, it's invalid access.
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setStatus('Exchanging token...');
          const token = await user.getIdToken();

          const response = await fetch('/api/strava/exchange', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code })
          });

          if (!response.ok) {
            throw new Error('Failed to exchange token');
          }

          toast.success('Strava connected successfully!');
          router.push('/');
        } catch (err) {
          console.error(err);
          toast.error('Failed to connect Strava');
          router.push('/');
        }
      } else {
        toast.error('Please login first');
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Connecting to Strava</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function StravaCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StravaCallbackContent />
    </Suspense>
  );
}
