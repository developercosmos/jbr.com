import { Plus, Search, CheckCircle, Truck, Package, Phone, MapPin, Trash2 } from "lucide-react";
import { getUserAddresses } from "@/actions/address";
import { AddressCard } from "./AddressCard";
import { AddAddressButton } from "./AddAddressButton";
import { AddressSearch } from "./AddressSearch";

interface SearchParams {
    search?: string;
}

export default async function AddressBookPage({
    searchParams
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams;
    const userAddresses = await getUserAddresses(params.search);

    return (
        <>
            {/* Page Heading */}
            <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">
                        Akun Saya / Alamat
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                        Daftar Alamat
                    </h1>
                </div>
                <AddAddressButton />
            </div>

            {/* Search & Filter */}
            <AddressSearch initialSearch={params.search} />

            {/* Address List */}
            {userAddresses.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                    <MapPin className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {params.search ? "Alamat tidak ditemukan" : "Belum ada alamat"}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {params.search
                            ? "Coba kata kunci lain atau tambah alamat baru."
                            : "Tambahkan alamat pengiriman untuk memudahkan checkout."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {userAddresses.map((address) => (
                        <AddressCard key={address.id} address={address} />
                    ))}
                </div>
            )}
        </>
    );
}
