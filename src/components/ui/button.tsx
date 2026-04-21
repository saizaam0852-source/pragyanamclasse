import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 btn-press select-none",
  {
    variants: {
      variant: {
        default:
          "gradient-saffron text-primary-foreground shadow-clay hover:shadow-glow-saffron hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-clay-sm hover:shadow-clay hover:-translate-y-0.5",
        outline:
          "bg-card text-foreground shadow-clay-sm hover:shadow-clay hover:-translate-y-0.5 border border-border/40",
        secondary:
          "gradient-indigo text-secondary-foreground shadow-clay-sm hover:shadow-glow-indigo hover:-translate-y-0.5",
        ghost:
          "bg-transparent hover:bg-muted hover:shadow-clay-sm",
        link:
          "text-primary underline-offset-4 hover:underline shadow-none",
        clay:
          "bg-card text-foreground shadow-clay hover:shadow-clay-lg hover:-translate-y-0.5",
        mint:
          "gradient-mint text-accent-foreground shadow-clay-sm hover:shadow-glow-mint hover:-translate-y-0.5",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-8 text-base",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
