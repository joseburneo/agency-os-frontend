export function Topbar() {
  return (
    <header className="hidden md:flex h-16 border-b border-border bg-background items-center px-8 justify-between shrink-0">
      <h1 className="text-sm font-medium text-muted-foreground">Overview / Dashboard</h1>
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-primary">
          JB
        </div>
      </div>
    </header>
  );
}
