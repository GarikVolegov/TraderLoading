import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

export function AuthSection({ login, signup }: { login: () => void; signup: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-primary" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hai già un account? Accedi per sincronizzare i tuoi dati. Sei nuovo?
          Registrati per iniziare.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={login} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Accedi
          </Button>
          <Button onClick={signup} variant="outline" className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            Registrati
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
