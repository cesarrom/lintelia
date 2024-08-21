/**
 * v0 by Vercel.
 * @see https://v0.dev/t/6P08DpLoSUk
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"

export default function Notifications() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid gap-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Unread Notifications</h2>
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Your order has been shipped</CardTitle>
                <CardDescription>Your order #12345 has been shipped and is on its way.</CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-sm text-muted-foreground">5 minutes ago</p>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Your subscription has been renewed</CardTitle>
                <CardDescription>Your subscription to our service has been successfully renewed.</CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-sm text-muted-foreground">1 hour ago</p>
              </CardFooter>
            </Card>
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-4">Read Notifications</h2>
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Your account password has been changed</CardTitle>
                <CardDescription>Your account password has been successfully changed.</CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-sm text-muted-foreground">3 days ago</p>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Your profile has been updated</CardTitle>
                <CardDescription>Your profile information has been successfully updated.</CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-sm text-muted-foreground">1 week ago</p>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}