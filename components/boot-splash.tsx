export function BootSplash() {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#09090b] px-6 text-center text-white">
      <div className="absolute inset-0 opacity-0" />
      <div className="relative flex flex-col items-center justify-center gap-0">
        <img
          src="/favicon-192x192.png"
          alt="Deeni.tv Logo"
          className="w-[clamp(60px,15vw,120px)] h-[clamp(60px,15vw,120px)] select-none mb-4"
          draggable="false"
        />
        <p className="text-white font-bold tracking-wider text-[clamp(1.2rem,3vw,2rem)]">
          Deeni.tv
        </p>
      </div>
    </div>
  )
}