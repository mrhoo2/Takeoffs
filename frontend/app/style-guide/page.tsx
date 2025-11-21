import React from 'react';

export default function StyleGuidePage() {
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
            {/* Top Bar Mockup */}
            <div className="h-16 border-b border-neutral-200 bg-white px-6 flex items-center justify-between sticky top-0 z-10">
                <div className="font-bold text-xl tracking-tight">BuildVision <span className="text-neutral-400 font-normal">Style Guide</span></div>
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-bv-blue-100 text-bv-blue-600 flex items-center justify-center text-sm font-bold">MK</div>
                </div>
            </div>

            <div className="flex">
                {/* Sidebar Mockup */}
                <div className="w-64 border-r border-neutral-200 bg-white min-h-[calc(100vh-64px)] p-4 hidden md:block shrink-0">
                    <div className="space-y-1">
                        <div className="px-3 py-2 rounded-md bg-bv-blue-50 text-bv-blue-700 font-medium text-sm">Overview</div>
                        <div className="px-3 py-2 rounded-md text-neutral-600 hover:bg-neutral-50 font-medium text-sm cursor-pointer">Typography</div>
                        <div className="px-3 py-2 rounded-md text-neutral-600 hover:bg-neutral-50 font-medium text-sm cursor-pointer">Colors</div>
                        <div className="px-3 py-2 rounded-md text-neutral-600 hover:bg-neutral-50 font-medium text-sm cursor-pointer">Components</div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 p-6 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
                    <div className="space-y-16">

                        {/* Typography Section */}
                        <section className="space-y-8">
                            <div className="border-b border-neutral-200 pb-4">
                                <h2 className="text-3xl font-bold text-neutral-900">Typography</h2>
                                <p className="text-neutral-500 mt-2">Inter is the sole typeface. Headers use Light and Bold weights. Body uses Regular and Bold.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-12 space-y-8">
                                    {/* Headers */}
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">64/88 Light</span>
                                            <h1 className="text-[64px] leading-[88px] font-light tracking-tight">BuildVision UI</h1>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">56/72 Bold</span>
                                            <h2 className="text-[56px] leading-[72px] font-bold tracking-tight">Project Takeoffs</h2>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">48/56 Light</span>
                                            <h3 className="text-[48px] leading-[56px] font-light">Mechanical Schedule</h3>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">36/48 Bold</span>
                                            <h4 className="text-[36px] leading-[48px] font-bold">Equipment Selection</h4>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">24/32 Bold</span>
                                            <h5 className="text-[24px] leading-[32px] font-bold">Upload Plans</h5>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="space-y-6 mt-12">
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">24/38 Regular</span>
                                            <p className="text-[24px] leading-[38px]">Body Large - The quick brown fox jumps over the lazy dog.</p>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">18/28 Regular</span>
                                            <p className="text-[18px] leading-[28px]">Body Medium - The quick brown fox jumps over the lazy dog.</p>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">16/22 Regular</span>
                                            <p className="text-[16px] leading-[22px]">Body Base - The quick brown fox jumps over the lazy dog.</p>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">14/18 Regular</span>
                                            <p className="text-[14px] leading-[18px]">Body Small - The quick brown fox jumps over the lazy dog.</p>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4 border-b border-neutral-100 pb-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">12/16 Regular</span>
                                            <p className="text-[12px] leading-[16px]">Caption - The quick brown fox jumps over the lazy dog.</p>
                                        </div>
                                    </div>

                                    {/* Links */}
                                    <div className="mt-8">
                                        <div className="flex flex-col md:flex-row md:items-baseline gap-4">
                                            <span className="text-neutral-400 w-32 text-sm font-mono">Link States</span>
                                            <div className="space-x-8">
                                                <a href="#" className="text-bv-blue-500 underline">Default Link</a>
                                                <a href="#" className="text-bv-blue-600 underline">Hover Link</a>
                                                <a href="#" className="text-bv-blue-700 underline">Active Link</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Colors Section */}
                        <section className="space-y-8">
                            <div className="border-b border-neutral-200 pb-4">
                                <h2 className="text-3xl font-bold text-neutral-900">Color System</h2>
                                <p className="text-neutral-500 mt-2">Primary brand colors, neutrals, and semantic status colors.</p>
                            </div>

                            <div className="space-y-8">
                                {/* BV Blue */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4">BV Blue (Primary)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
                                        {[
                                            { name: '50', color: 'bg-bv-blue-50', hex: '#E9EEFF', text: 'text-bv-blue-800' },
                                            { name: '100', color: 'bg-bv-blue-100', hex: '#ABB8FF', text: 'text-bv-blue-800' },
                                            { name: '200', color: 'bg-bv-blue-200', hex: '#7383FF', text: 'text-white' },
                                            { name: '300', color: 'bg-bv-blue-300', hex: '#4A3AFF', text: 'text-white' },
                                            { name: '400', color: 'bg-bv-blue-400', hex: '#3F31DE', text: 'text-white' },
                                            { name: '500', color: 'bg-bv-blue-500', hex: '#3528BE', text: 'text-white' },
                                            { name: '600', color: 'bg-bv-blue-600', hex: '#201B80', text: 'text-white' },
                                            { name: '700', color: 'bg-bv-blue-700', hex: '#171063', text: 'text-white' },
                                            { name: '800', color: 'bg-bv-blue-800', hex: '#06042E', text: 'text-white' },
                                        ].map((c) => (
                                            <div key={c.name} className={`${c.color} h-24 rounded-lg p-3 flex flex-col justify-between shadow-sm`}>
                                                <span className={`text-xs font-bold ${c.text}`}>{c.name}</span>
                                                <span className={`text-xs font-mono ${c.text}`}>{c.hex}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Neutrals */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4">Neutrals</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
                                        {[
                                            { name: '50', color: 'bg-neutral-50', hex: '#F8F8F8', text: 'text-neutral-900' },
                                            { name: '100', color: 'bg-neutral-100', hex: '#EDEDED', text: 'text-neutral-900' },
                                            { name: '200', color: 'bg-neutral-200', hex: '#C9C8CF', text: 'text-neutral-900' },
                                            { name: '300', color: 'bg-neutral-300', hex: '#AEB0B7', text: 'text-white' },
                                            { name: '400', color: 'bg-neutral-400', hex: '#9E9EA5', text: 'text-white' },
                                            { name: '500', color: 'bg-neutral-500', hex: '#8C8C92', text: 'text-white' },
                                            { name: '600', color: 'bg-neutral-600', hex: '#6C6C71', text: 'text-white' },
                                            { name: '700', color: 'bg-neutral-700', hex: '#535257', text: 'text-white' },
                                            { name: '800', color: 'bg-neutral-800', hex: '#2A2A2F', text: 'text-white' },
                                            { name: '900', color: 'bg-neutral-900', hex: '#18191B', text: 'text-white' },
                                        ].map((c) => (
                                            <div key={c.name} className={`${c.color} h-24 rounded-lg p-3 flex flex-col justify-between shadow-sm`}>
                                                <span className={`text-xs font-bold ${c.text}`}>{c.name}</span>
                                                <span className={`text-xs font-mono ${c.text}`}>{c.hex}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Semantic Colors */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4">Semantic Scales</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                        {/* Red */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-neutral-500">Red (Error/Danger)</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-red-100 h-16 rounded-md"></div>
                                                <div className="bg-red-500 h-16 rounded-md"></div>
                                                <div className="bg-red-700 h-16 rounded-md"></div>
                                            </div>
                                        </div>
                                        {/* Yellow */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-neutral-500">Yellow (Warning)</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-yellow-100 h-16 rounded-md"></div>
                                                <div className="bg-yellow-500 h-16 rounded-md"></div>
                                                <div className="bg-yellow-700 h-16 rounded-md"></div>
                                            </div>
                                        </div>
                                        {/* Green */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-neutral-500">Green (Success)</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-green-100 h-16 rounded-md"></div>
                                                <div className="bg-green-500 h-16 rounded-md"></div>
                                                <div className="bg-green-700 h-16 rounded-md"></div>
                                            </div>
                                        </div>
                                        {/* Purple */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-neutral-500">Purple (Accent)</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-purple-100 h-16 rounded-md"></div>
                                                <div className="bg-purple-500 h-16 rounded-md"></div>
                                                <div className="bg-purple-700 h-16 rounded-md"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Components Section */}
                        <section className="space-y-8">
                            <div className="border-b border-neutral-200 pb-4">
                                <h2 className="text-3xl font-bold text-neutral-900">Components</h2>
                                <p className="text-neutral-500 mt-2">Core interactive elements and primitives.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                                {/* Buttons */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold">Buttons</h3>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <button className="bg-bv-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-bv-blue-600 focus:ring-2 focus:ring-bv-blue-500 focus:ring-offset-2 transition-all shadow-sm">
                                            Primary Action
                                        </button>
                                        <button className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-50 focus:ring-2 focus:ring-bv-blue-500 focus:ring-offset-2 transition-all shadow-sm">
                                            Secondary Action
                                        </button>
                                        <button className="bg-bv-blue-50 text-bv-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-bv-blue-100 transition-all">
                                            Ghost / Tertiary
                                        </button>
                                        <button disabled className="bg-neutral-200 text-neutral-400 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-50">
                                            Disabled
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <button className="bg-white border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-neutral-50 shadow-sm">
                                            View
                                        </button>
                                    </div>
                                </div>

                                {/* Chips & Badges */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold">Status Chips</h3>
                                    <div className="flex flex-wrap gap-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                                            Draft
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bv-blue-100 text-bv-blue-800">
                                            Bidding
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Active
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            Overdue
                                        </span>
                                    </div>
                                </div>

                                {/* Inputs & Dropdowns */}
                                <div className="space-y-6 lg:col-span-2">
                                    <h3 className="text-lg font-bold">Form Elements</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-neutral-700">Input Field</label>
                                            <input
                                                type="text"
                                                placeholder="Enter value..."
                                                className="block w-full rounded-lg border-neutral-200 shadow-sm focus:border-bv-blue-500 focus:ring-bv-blue-500 sm:text-sm py-2 px-3 border"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-neutral-700">Dropdown</label>
                                            <select className="block w-full rounded-lg border-neutral-200 shadow-sm focus:border-bv-blue-500 focus:ring-bv-blue-500 sm:text-sm py-2 px-3 border bg-white">
                                                <option>Option 1</option>
                                                <option>Option 2</option>
                                                <option>Option 3</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-neutral-700">Disabled Input</label>
                                            <input
                                                type="text"
                                                disabled
                                                value="Cannot edit this"
                                                className="block w-full rounded-lg border-neutral-200 bg-neutral-50 text-neutral-500 shadow-sm sm:text-sm py-2 px-3 border cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Data Table */}
                                <div className="space-y-6 lg:col-span-2">
                                    <h3 className="text-lg font-bold">Data Table</h3>
                                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                        <table className="min-w-full divide-y divide-neutral-200">
                                            <thead className="bg-neutral-50">
                                                <tr>
                                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-neutral-900 sm:pl-6">Project Name</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-neutral-900">Status</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-neutral-900">Date</th>
                                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                        <span className="sr-only">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-200 bg-white">
                                                <tr className="bg-white hover:bg-neutral-50 transition-colors">
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-neutral-900 sm:pl-6">Office Complex A</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bv-blue-100 text-bv-blue-800">
                                                            Bidding
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">Oct 24, 2023</td>
                                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <a href="#" className="text-bv-blue-600 hover:text-bv-blue-900">Edit</a>
                                                    </td>
                                                </tr>
                                                <tr className="bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-neutral-900 sm:pl-6">Downtown Retail</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                                                            Draft
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">Oct 22, 2023</td>
                                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <a href="#" className="text-bv-blue-600 hover:text-bv-blue-900">Edit</a>
                                                    </td>
                                                </tr>
                                                <tr className="bg-white hover:bg-neutral-50 transition-colors">
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-neutral-900 sm:pl-6">Westside Hospital</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Active
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-neutral-500">Oct 20, 2023</td>
                                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <a href="#" className="text-bv-blue-600 hover:text-bv-blue-900">Edit</a>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
