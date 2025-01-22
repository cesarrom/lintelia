import { NextResponse } from 'next/server';
import { ManagementClient } from 'auth0';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_MGMT_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || '',
});

interface Auth0User {
  user_id: string;
  email: string;
  name?: string;
  last_login?: string;
}

interface Auth0Role {
  name: string;
}

export async function GET(request: Request) {
  try {
    // Get the tenant from the request headers or URL
    const url = new URL(request.url);
    const tenant = url.hostname.split('.')[0];

    // Get organization members
    const { data: members } = await auth0.organizations.getMembers({ id: tenant });
    
    // Get detailed user information for each member
    const userPromises = members.map(async (member: { user_id: string }) => {
      const { data: user } = await auth0.users.get({ id: member.user_id }) as { data: Auth0User };
      const { data: roles } = await auth0.users.getRoles({ id: member.user_id }) as { data: Auth0Role[] };
      
      return {
        id: user.user_id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        roles: roles.map(role => role.name),
        lastLogin: user.last_login,
      };
    });

    const users = await Promise.all(userPromises);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 