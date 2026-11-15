import { useAuth } from '@/lib/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** The signed-in user's profile (replaces the Descope profile widget). */
export default function ProfilePage() {
  const { user, tenant, permissions, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{user.name || user.email}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm"><span className="text-muted-foreground">Account type: </span>{user.kind}</div>
          {tenant && <div className="text-sm"><span className="text-muted-foreground">Institution: </span>{tenant.name}</div>}
          <div className="space-x-1">{permissions.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}</div>
          <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
