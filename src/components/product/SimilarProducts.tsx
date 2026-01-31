export function SimilarProducts() {
    return (
        <div className="mt-20 border-t border-slate-200 dark:border-gray-800 pt-10 mb-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                Kamu mungkin juga suka
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Card 1 */}
                <div className="group cursor-pointer">
                    <div className="bg-surface-dark aspect-square rounded-lg mb-3 overflow-hidden">
                        <div
                            className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBDQvuWpepSKVEc2ar7bDjK5SP2PxeH30ONb_SlIp80KuHpVqGSlu78XyJpCgZcvcHSrSgTo9HAHgmZnFKhqv3dSVCZoeeSCD3D7Znt4AZSQmDRlfQcvzaqXMkbDEDwGZaNApcGTdL7u8zXe6b4ELSwX9t395bleyTdJD_u1ekwbJ2DdSQunS7vr5MZObTiorXw9DMxeNGT6U0zv1UcPuie4u8kZJvZIIGeUiVdSKjqsrSG610aWePYvvRSRT_mC825iNBabuS1Eu0')",
                            }}
                        ></div>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">
                        Adidas Ultraboost 22
                    </h4>
                    <p className="text-slate-500 text-xs mb-1">Kondisi 9/10</p>
                    <p className="text-slate-900 dark:text-white font-bold">
                        Rp 1.100.000
                    </p>
                </div>
                {/* Card 2 */}
                <div className="group cursor-pointer">
                    <div className="bg-surface-dark aspect-square rounded-lg mb-3 overflow-hidden">
                        <div
                            className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDllOZIu8OzmuzzoAXFjbayKK-osFZp2_LtlAYeDKSFIfJHoYAa7azTN0xkrwon4bXdGO9qfjSVq4tPN1--lODSe3-zCyfOJPOXfyJYONX5HT5Ayd2Pcq-0BcDFRllYS2o1cFATFeI7JtjAO22wbgISNVVVueTn8BLme-shcfNi7qVi97RUaAX9INyePVpnaO_rELgST2sVyok96wMyYd0dMqWCUsydk_pBFw74gmGFCH8iakcvrb50rfsncc37i229G4ZKAwaG0UA')",
                            }}
                        ></div>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">
                        Asics Novablast 3
                    </h4>
                    <p className="text-slate-500 text-xs mb-1">Kondisi 7/10</p>
                    <p className="text-slate-900 dark:text-white font-bold">Rp 950.000</p>
                </div>
                {/* Card 3 */}
                <div className="group cursor-pointer">
                    <div className="bg-surface-dark aspect-square rounded-lg mb-3 overflow-hidden">
                        <div
                            className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCRiPIlgllpQc1OLmhhd5uDJN-9jwHp0OoeQyobEoAE-Wf6CClN3keVoTcrIPxMPUetW7g9enM7KXX4NMogfYCXlCyTYAdaAQGOyWbyoVi4OnQR7EQpRFCcLYSqoqpC0g1I2zHfPT0SMFirL_BmAr2hgi25HkmHelIHi56faPU09QSgzRsGMjwYSSn9fbHjhWSEMbIVPwrq5IUQOzlk3hcCtAmAj9Mdv0EDMkv7oh-8nZ8QxKIt2z9xyShJF1zMxVrgpQSE6progaA')",
                            }}
                        ></div>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">
                        New Balance 1080v12
                    </h4>
                    <p className="text-slate-500 text-xs mb-1">New In Box</p>
                    <p className="text-slate-900 dark:text-white font-bold">
                        Rp 1.800.000
                    </p>
                </div>
                {/* Card 4 */}
                <div className="group cursor-pointer">
                    <div className="bg-surface-dark aspect-square rounded-lg mb-3 overflow-hidden">
                        <div
                            className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAOl0I1Y3U-OqdFCZ45kT9GR4n5zr7OOojWw0pha_5GEVA0-_n46V4M6RQJQroz0pLtg7HONbYGPctgy2D3RRs1-rWdmtSyP9tuFo-V0nvNuKfmJeEWuKNDKzxU7XUVETAQC-RiOQWzgU7fXpbYzZ5_Jbryh5p_9Q3Isu7QNGH4frXpyRKF_BeTCKnDivgcoDAqvo1tRyHP2AdvkG0GjBovpw7oU8YzL_eZm8yLz00PI26J-ZkybLc49W6aUyoemI7ZpP25xTI8JO8')",
                            }}
                        ></div>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">
                        Hoka Clifton 9
                    </h4>
                    <p className="text-slate-500 text-xs mb-1">Kondisi 8.5/10</p>
                    <p className="text-slate-900 dark:text-white font-bold">
                        Rp 1.450.000
                    </p>
                </div>
            </div>
        </div>
    );
}
