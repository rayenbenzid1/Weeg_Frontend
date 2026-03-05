import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff, UserPlus, Check, Building2, Mail, Phone, User, Lock, Globe, MapPin, Server } from 'lucide-react';
import { toast } from 'sonner';
import logoImage from '../components/image/logo.jpeg';

// ─── 1. Business activities — commerce focused ────────────────────────────────

const INDUSTRIES = [
  'General Retail',
  'Wholesale & Distribution',
  'Supermarkets & Grocery',
  'Pharmacies & Medical Supplies',
  'Electronics & Appliances Retail',
  'Clothing & Fashion Retail',
  'Furniture & Home Goods',
  'Building Materials & Hardware',
  'Auto Parts & Accessories',
  'Office Supplies & Stationery',
  'Cosmetics & Personal Care',
  'Toys & Sports Equipment',
  'Books & Educational Materials',
  'Import & Export',
  'Trading Company',
  'Free Zone Trading',
  'Food Distribution',
  'Beverages Distribution',
  'Bakeries & Confectioneries',
  'Restaurants & Catering',
  'Logistics & Freight',
  'E-Commerce',
  'Other',
];

// ─── 2. All world countries with major cities ─────────────────────────────────

const COUNTRIES_CITIES: Record<string, string[]> = {
  Afghanistan: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Other'],
  Albania: ['Tirana', 'Durrës', 'Vlorë', 'Shkodër', 'Other'],
  Algeria: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Sétif', 'Tlemcen', 'Béjaïa', 'Other'],
  Angola: ['Luanda', 'Huambo', 'Lobito', 'Benguela', 'Other'],
  Argentina: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Other'],
  Armenia: ['Yerevan', 'Gyumri', 'Vanadzor', 'Other'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Other'],
  Austria: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Other'],
  Azerbaijan: ['Baku', 'Ganja', 'Sumqayit', 'Other'],
  Bahrain: ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Other'],
  Bangladesh: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Other'],
  Belarus: ['Minsk', 'Gomel', 'Mogilev', 'Vitebsk', 'Other'],
  Belgium: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège', 'Other'],
  Bolivia: ['La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre', 'Other'],
  'Bosnia and Herzegovina': ['Sarajevo', 'Banja Luka', 'Mostar', 'Other'],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Manaus', 'Other'],
  Bulgaria: ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Other'],
  Cameroon: ['Yaoundé', 'Douala', 'Bamenda', 'Bafoussam', 'Other'],
  Canada: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Other'],
  Chile: ['Santiago', 'Valparaíso', 'Concepción', 'Antofagasta', 'Other'],
  China: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Wuhan', 'Tianjin', 'Nanjing', 'Other'],
  Colombia: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Other'],
  'Congo (DRC)': ['Kinshasa', 'Lubumbashi', 'Mbuji-Mayi', 'Kisangani', 'Other'],
  'Costa Rica': ['San José', 'Cartago', 'Heredia', 'Alajuela', 'Other'],
  "Côte d'Ivoire": ['Abidjan', 'Bouaké', 'Daloa', 'Yamoussoukro', 'Other'],
  Croatia: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Other'],
  Cuba: ['Havana', 'Santiago de Cuba', 'Camagüey', 'Other'],
  'Czech Republic': ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Other'],
  Denmark: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Other'],
  'Dominican Republic': ['Santo Domingo', 'Santiago', 'La Romana', 'Other'],
  Ecuador: ['Guayaquil', 'Quito', 'Cuenca', 'Other'],
  Egypt: ['Cairo', 'Alexandria', 'Giza', 'Port Said', 'Suez', 'Luxor', 'Aswan', 'Mansoura', 'Other'],
  Ethiopia: ['Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Hawassa', 'Other'],
  Finland: ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Other'],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Other'],
  Georgia: ['Tbilisi', 'Kutaisi', 'Batumi', 'Rustavi', 'Other'],
  Germany: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Other'],
  Ghana: ['Accra', 'Kumasi', 'Tamale', 'Sekondi-Takoradi', 'Other'],
  Greece: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Other'],
  Guatemala: ['Guatemala City', 'Quetzaltenango', 'Escuintla', 'Other'],
  Hungary: ['Budapest', 'Debrecen', 'Miskolc', 'Pécs', 'Other'],
  India: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Other'],
  Indonesia: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Bekasi', 'Makassar', 'Other'],
  Iran: ['Tehran', 'Mashhad', 'Isfahan', 'Karaj', 'Shiraz', 'Tabriz', 'Other'],
  Iraq: ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Kirkuk', 'Najaf', 'Other'],
  Ireland: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Other'],
  Italy: ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Other'],
  Japan: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kyoto', 'Other'],
  Jordan: ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Madaba', 'Jarash', 'Other'],
  Kazakhstan: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Other'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Other'],
  Kuwait: ['Kuwait City', 'Ahmadi', 'Hawalli', 'Farwaniya', 'Jahra', 'Other'],
  Lebanon: ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Jounieh', 'Other'],
  Libya: ['Tripoli', 'Benghazi', 'Misrata', 'Zawiya', 'Zliten', 'Khoms', 'Sirte', 'Sabha', 'Tobruk', 'Derna', 'Other'],
  Malaysia: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Subang Jaya', 'Other'],
  Mali: ['Bamako', 'Sikasso', 'Mopti', 'Koutiala', 'Other'],
  Mexico: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Other'],
  Morocco: ['Casablanca', 'Rabat', 'Fès', 'Marrakech', 'Tangier', 'Salé', 'Meknes', 'Oujda', 'Agadir', 'Other'],
  Mozambique: ['Maputo', 'Matola', 'Nampula', 'Beira', 'Other'],
  Myanmar: ['Yangon', 'Mandalay', 'Naypyidaw', 'Other'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Other'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Other'],
  Niger: ['Niamey', 'Zinder', 'Maradi', 'Tahoua', 'Other'],
  Nigeria: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna', 'Other'],
  Norway: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Other'],
  Oman: ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Other'],
  Pakistan: ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Peshawar', 'Other'],
  Palestine: ['Ramallah', 'Gaza', 'Hebron', 'Nablus', 'Jenin', 'Other'],
  Panama: ['Panama City', 'Colón', 'David', 'Other'],
  Paraguay: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Other'],
  Peru: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Cusco', 'Other'],
  Philippines: ['Manila', 'Quezon City', 'Davao', 'Cebu', 'Zamboanga', 'Other'],
  Poland: ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Other'],
  Portugal: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Other'],
  Qatar: ['Doha', 'Al Wakrah', 'Al Khor', 'Al Rayyan', 'Other'],
  Romania: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Other'],
  Russia: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Chelyabinsk', 'Other'],
  Rwanda: ['Kigali', 'Butare', 'Gisenyi', 'Other'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha', 'Other'],
  Senegal: ['Dakar', 'Thiès', 'Kaolack', 'Ziguinchor', 'Saint-Louis', 'Other'],
  Serbia: ['Belgrade', 'Novi Sad', 'Niš', 'Kragujevac', 'Other'],
  Singapore: ['Singapore'],
  Somalia: ['Mogadishu', 'Hargeisa', 'Kismayo', 'Bosaso', 'Other'],
  'South Africa': ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'Other'],
  'South Korea': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Other'],
  Spain: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Malaga', 'Zaragoza', 'Other'],
  Sudan: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'Obeid', 'Other'],
  Sweden: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Other'],
  Switzerland: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Other'],
  Syria: ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Other'],
  Tanzania: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Mbeya', 'Other'],
  Thailand: ['Bangkok', 'Chiang Mai', 'Pattaya', 'Phuket', 'Hat Yai', 'Other'],
  Tunisia: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès', 'Ariana', 'Gafsa', 'Monastir', 'Other'],
  Turkey: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Other'],
  Uganda: ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Other'],
  Ukraine: ['Kyiv', 'Kharkiv', 'Odessa', 'Dnipro', 'Lviv', 'Other'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Al Ain', 'Other'],
  'United Kingdom': ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Other'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'Dallas', 'Miami', 'Other'],
  Uruguay: ['Montevideo', 'Salto', 'Ciudad de la Costa', 'Other'],
  Uzbekistan: ['Tashkent', 'Samarkand', 'Namangan', 'Andijan', 'Other'],
  Venezuela: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Other'],
  Vietnam: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Haiphong', 'Can Tho', 'Other'],
  Yemen: ['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Ibb', 'Other'],
  Zambia: ['Lusaka', 'Ndola', 'Kitwe', 'Livingstone', 'Other'],
  Zimbabwe: ['Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Other'],
  Other: ['Other'],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SignupPage() {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    industry: '',
    country: '',
    city: '',
    currentErp: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof formData) => (v: string) => {
    if (key === 'country') {
      setFormData(prev => ({ ...prev, country: v, city: '' }));
    } else {
      setFormData(prev => ({ ...prev, [key]: v }));
    }
  };

  const availableCities = formData.country ? (COUNTRIES_CITIES[formData.country] ?? ['Other']) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim())  { toast.error('Company name is required'); return; }
    if (!formData.industry)            { toast.error('Please select a business activity'); return; }
    if (!formData.country)             { toast.error('Please select a country'); return; }
    if (!formData.city)                { toast.error('Please select a city'); return; }
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (formData.password.length < 8)  { toast.error('Password must be at least 8 characters'); return; }

    const result = await signup({
      name:        `${formData.firstName} ${formData.lastName}`.trim(),
      email:       formData.email,
      phone:       formData.phone,
      password:    formData.password,
      role:        'manager',
      companyName: formData.companyName.trim(),
      industry:    formData.industry,
      country:     formData.country,
      city:        formData.city,
      currentErp:  formData.currentErp,
    });

    if (result.success) {
      toast.success(result.message);
      setTimeout(() => navigate('/login'), 2000);
    } else {
      toast.error(result.message);
    }
  };

  const textField = (
    id: keyof typeof formData, label: string, type: string,
    placeholder: string, icon: React.ReactNode, required = true, hint?: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && <span className="text-sky-500 ml-0.5">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input id={id} type={type} placeholder={placeholder} value={formData[id]}
          onChange={e => set(id)(e.target.value)} required={required} disabled={isLoading}
          className="pl-9 h-10 text-sm border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-slate-50 dark:bg-slate-800/50" />
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );

  const selectField = (
    id: keyof typeof formData, label: string, options: string[],
    icon: React.ReactNode, placeholder: string, required = true, disabled = false
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && <span className="text-sky-500 ml-0.5">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">{icon}</span>
        <select id={id} value={formData[id]} onChange={e => set(id)(e.target.value)}
          required={required} disabled={isLoading || disabled}
          className={`w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 bg-slate-50 dark:bg-slate-800/50 appearance-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${!formData[id] ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
          <option value="" disabled>{placeholder}</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #fafafa 50%, #fff7ed 100%)' }}>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 80% 10%, #bae6fd, transparent 55%)' }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 10% 90%, #fed7aa, transparent 55%)' }} />
      <div className="absolute top-10 left-10 w-24 h-24 rounded-2xl opacity-10 rotate-12 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }} />

      <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #0284c7, #38bdf8 50%, #f97316)' }} />

        <div className="bg-white dark:bg-slate-900 p-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
            <img src={logoImage} alt="Weeg" className="h-20 object-contain" />
            <Link to="/login" className="group flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-all hover:shadow-md"
              style={{ borderColor: '#e2e8f0', background: 'linear-gradient(135deg, #f8fafc, #f0f9ff)' }}>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Already registered?</p>
                <p className="text-sm font-black leading-none" style={{ color: '#0284c7' }}>Sign in</p>
              </div>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>

          {/* Title */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white leading-none mb-2">Create your account</h1>
              <p className="text-slate-400 text-sm">Manager access · Pending administrator approval</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-2 w-8 rounded-full" style={{ background: i === 1 ? '#0284c7' : '#bae6fd' }} />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">

            {/* Section 1 — Identity */}
            <section>
              <SectionHeader index={1} label="Identity" />
              <div className="grid grid-cols-2 gap-4">
                {textField('firstName', 'First name', 'text', 'John', <User className="h-4 w-4" />)}
                {textField('lastName',  'Last name',  'text', 'Doe',  <User className="h-4 w-4" />)}
              </div>
            </section>

            {/* Section 2 — Contact */}
            <section>
              <SectionHeader index={2} label="Contact" />
              <div className="grid grid-cols-2 gap-4">
                {textField('email', 'Email', 'email', 'your@email.com', <Mail className="h-4 w-4" />)}
                {textField('phone', 'Phone', 'tel', '+216 xx xxx xxx', <Phone className="h-4 w-4" />, false)}
              </div>
            </section>

            {/* Section 3 — Company */}
            <section>
              <SectionHeader index={3} label="Company" />
              <div className="space-y-4">

                {textField('companyName', 'Company name', 'text', 'Official company name',
                  <Building2 className="h-4 w-4" />, true, 'If the company already exists, you will be linked to it.')}

                {selectField('industry', 'Business activity', INDUSTRIES,
                  <Building2 className="h-4 w-4" />, 'Select your activity...')}

                <div className="grid grid-cols-2 gap-4">
                  {selectField('country', 'Country', Object.keys(COUNTRIES_CITIES).sort(),
                    <Globe className="h-4 w-4" />, 'Select a country...')}
                  {selectField('city', 'City', availableCities, <MapPin className="h-4 w-4" />,
                    formData.country ? 'Select a city...' : 'Select a country first...',
                    true, !formData.country)}
                </div>

                {/* Current ERP — free text input ✅ */}
                <div className="space-y-1.5">
                  <Label htmlFor="currentErp" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current ERP / Software
                    <span className="ml-1 text-slate-300 font-normal normal-case tracking-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Server className="h-4 w-4" />
                    </span>
                    <Input id="currentErp" type="text"
                      placeholder="e.g. SAP, Odoo, Custom software, None..."
                      value={formData.currentErp}
                      onChange={e => set('currentErp')(e.target.value)}
                      disabled={isLoading}
                      className="pl-9 h-10 text-sm border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-slate-50 dark:bg-slate-800/50" />
                  </div>
                  <p className="text-[11px] text-slate-400">The software currently used to manage your business (accounting, inventory, etc.)</p>
                </div>

              </div>
            </section>

            {/* Section 4 — Security */}
            <section>
              <SectionHeader index={4} label="Security" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Password<span className="text-sky-500 ml-0.5">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters"
                      value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      required disabled={isLoading}
                      className="pl-9 pr-10 h-10 text-sm border-slate-200 focus:border-sky-400 bg-slate-50 dark:bg-slate-800/50" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Confirm password<span className="text-sky-500 ml-0.5">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Repeat your password"
                      value={formData.confirmPassword} onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                      required disabled={isLoading}
                      className="pl-9 h-10 text-sm border-slate-200 focus:border-sky-400 bg-slate-50 dark:bg-slate-800/50" />
                  </div>
                </div>
              </div>
            </section>

            {/* Submit */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-3 flex-1 rounded-xl px-4 py-3 border"
                style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}>
                  <Check className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  <span className="font-semibold text-sky-600">Manager access</span> — reviewed by an admin before activation.
                </p>
              </div>
              <Button type="submit"
                className="shrink-0 text-white font-bold px-8 h-11 rounded-xl shadow-lg"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', minWidth: '180px' }}
                disabled={isLoading}>
                {isLoading
                  ? <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Creating...</span>
                  : <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Create account</span>}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
        style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}>{index}</div>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
    </div>
  );
}