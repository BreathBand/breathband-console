"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LiveTrace } from "@/components/LiveTrace";
import { useDevice } from "@/lib/device/DeviceProvider";
import { stateWords } from "./words";

/** The band's state in the sidebar: what's connected, how it's doing, and a live breath when there is one. */
export function DeviceStatus() {
  const device = useDevice();
  const pathname = usePathname();
  const { status, connected, kind } = device;
  const name = kind === "simulated" ? "Simulated band" : (status.deviceName ?? "Breathband");
  const words = device.stalled ? "No signal" : stateWords(status.state);

  return (
    <Link
      href="/cloud/device/"
      className="side-device"
      data-state={device.stalled ? "stalled" : status.state}
      aria-current={pathname === "/cloud/device/" ? "page" : undefined}
    >
      <span className="side-device-head">
        <Icon name={kind === "simulated" ? "signal" : "bluetooth"} size={16} />
        <span className="side-device-name">{connected ? name : "No band connected"}</span>
        {connected && typeof status.battery === "number" && <span className="side-device-batt">{status.battery}%</span>}
      </span>
      {connected ? (
        <LiveTrace read={device.recent} window={200} height={28} lineWidth={1.6} label={`${name}, live signal`} />
      ) : null}
      <span className="side-device-state">
        <i aria-hidden="true" />
        {connected ? words : status.state === "idle" ? "Connect a band or the simulator" : words}
      </span>
    </Link>
  );
}
