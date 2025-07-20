import { ScrollArea } from "@/ui/scroll-area"
import { SidebarInset } from "@/ui/sidebar"
import { AppHeader } from "./AppHeader"

const AppContent = ({ children }: { children: React.ReactNode }) => {
    return (
        <SidebarInset>
            <AppHeader />
            <ScrollArea
                // className="h-screen"
                //@ts-ignore
                >
                <main className="mb-40 p-2 ">
                    {children}
                </main>
            </ScrollArea>
        </SidebarInset>
    )
}
export { AppContent }