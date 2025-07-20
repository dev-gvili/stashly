import { ModeToggle } from "./mode-toggle"
// import { UserMenu } from "./UserMenu";
// import type { User } from "better-auth";

export function AppHeader() {
    return (
        <header className="z-9990 flex items-center h-14 justify-end bg-background px-4 py-2 sticky top-0  shrink-0 ">
            <div className="flex items-center space-x-2">
                {/* <UserMenu user={user}/> */}
                <ModeToggle />
            </div>
        </header>
    )
}
