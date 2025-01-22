import { NextResponse } from 'next/server';
import { ManagementClient } from 'auth0';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_MGMT_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || '',
});

interface InviteUserRequest {
  email: string;
  tenant: string;
}

interface Auth0User {
  user_id: string;
  email: string;
}

export async function POST(request: Request) {
  try {
    const { email, tenant } = await request.json() as InviteUserRequest;

    // Create user if they don't exist
    let user: Auth0User;
    try {
      // Search for user by email
      const { data: users } = await auth0.users.getAll({
        q: `email:"${email}"`,
        search_engine: 'v3',
      }) as { data: Auth0User[] };
      
      if (users.length === 0) {
        throw new Error('User not found');
      }
      user = users[0];
    } catch {
      // Create new user
      const { data } = await auth0.users.create({
        email,
        connection: 'Username-Password-Authentication',
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
      }) as { data: Auth0User };
      user = data;
    }

    // Add user to organization
    await auth0.organizations.addMembers({ id: tenant }, {
      members: [user.user_id],
    });

    // Create change password ticket
    const ticket = await auth0.tickets.changePassword({
      user_id: user.user_id,
      client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
      organization_id: tenant,
      result_url: `https://${tenant}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/dashboard`,
      ttl_sec: 86400, // 24 hours
      mark_email_as_verified: true,
      includeEmailInRedirect: true,
    });

    return NextResponse.json({
      message: 'User invited successfully',
      ticket,
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    return NextResponse.json(
      { message: 'Failed to invite user' },
      { status: 500 }
    );
  }
} 