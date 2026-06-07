import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card/60 backdrop-blur-sm border border-border/30 p-8 rounded-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
        </div>
        <h1 className="text-4xl font-bold font-mono">404</h1>
        <p className="text-muted-foreground text-lg">
          {t("notfound.message")}
        </p>
        <Link href="/" className="inline-block">
          <Button size="lg" className="w-full">
            {t("notfound.back")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
