import { Button } from "@/ui/button";
import { cn } from "@/utils/styles";
import { authClient } from "@/services/auth.client";
import {
  RiAppleFill,
  RiCircleLine,
  RiGithubFill,
  RiGoogleFill,
  RiMicrosoftFill,
} from "@remixicon/react";
import type {auth} from "@/services/auth.server";

type Providers = keyof typeof auth.options.socialProviders
interface AuthButtonProps extends React.ComponentProps<typeof Button> {
  provider: Providers;
}

const toProviderIcon = (provider: Providers) => {
  switch (provider) {
    case "github":
      return <RiGithubFill className="size-6" />;
    case "google":
      return <RiGoogleFill className="size-6" />;
    case "microsoft":
      return <RiMicrosoftFill className="size-6" />;
    // case "apple":
    //   return <RiAppleFill className="size-6" />;
    default:
      return <RiCircleLine className="size-6" />;
  }
};
const AuthButton = ({
  provider,
  className,
  children,
  variant = "outline",
  ...props
}: AuthButtonProps) => {
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("border-dashed border-border", className)}
      {...props}
      onClick={() => {
        authClient.signIn.social({
          provider,
          callbackURL: "/dashboard",
        });
      }}
    >
      {toProviderIcon(provider)}
      {children}
    </Button>
  );
};

export { AuthButton };
