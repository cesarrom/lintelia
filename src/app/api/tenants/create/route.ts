import { NextResponse } from 'next/server';
import { ManagementClient } from 'auth0';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_MGMT_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || '',
});

export async function POST(request: Request) {
  try {
    const { institutionName, subdomain, adminEmail, adminName } = await request.json();

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return NextResponse.json(
        { message: 'Invalid subdomain format' },
        { status: 400 }
      );
    }

    // Create Auth0 organization (tenant)
    const organization = await auth0.organizations.create({
      name: subdomain,
      display_name: institutionName,
      metadata: {
        subdomain,
      },
    });

    // Create admin user if they don't exist
    let user = await auth0.users.getByEmail(adminEmail).catch(() => null);
    
    if (!user) {
      user = await auth0.users.create({
        email: adminEmail,
        name: adminName,
        connection: 'Username-Password-Authentication',
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
      });
    }

    // Add user to organization
    await auth0.organizations.addMembers(organization.id, {
      members: [user.user_id],
    });

    // Assign admin role to user
    const adminRole = await auth0.roles.create({
      name: `${subdomain}-admin`,
      description: `Admin role for ${institutionName}`,
    });

    await auth0.users.assignRoles(user.user_id, {
      roles: [adminRole.id],
    });

    // Send welcome email with password reset link
    await auth0.tickets.verifyEmail({
      user_id: user.user_id,
      result_url: `https://${subdomain}.yourdomain.com/dashboard`,
    });

    return NextResponse.json({
      message: 'Tenant created successfully',
      organization: organization.id,
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { message: 'Failed to create tenant' },
      { status: 500 }
    );
  }
} 