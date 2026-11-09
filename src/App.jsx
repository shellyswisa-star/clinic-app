import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const CLINIC_INFO = {
  name: "שורשים",
  tagline: "מרחב טיפולי שקט במושב אביאל",
  address: "מושב אביאל, אלונה",
  hours: "א' - ה': 09:00 - 18:00",
  imageUrl: "/clinic-space.jpg"
};

const PLANS = [
  { 
    id: 'session', 
    title: 'ססיה שבועית (משמרת קבועה)', 
    price: 500,
    priceDisplay: '500 ₪ / חודש', 
    badge: 'הכי מבוקש',
    desc: 'משמרת קבועה אחת לשבוע בכל שבוע לאורך החודש (4 משמרות בחודש).' 
  },
  { 
    id: 'hourly', 
    title: 'השכרה שעתית גמישה', 
    price: 65,
    priceDisplay: '65 ₪ / שעה', 
    desc: 'הזמנת משמרת בודדת (4 שעות) לפי דרישה למועד מסוים.' 
  },
  { 
    id: 'daily', 
    title: 'השכרה יומית חד-פעמית', 
    price: 500,
    priceDisplay: '500 ₪ / יום', 
    desc: 'יום עבודה מלא ופרטי (09:00 - 18:00) בתאריך בודד.' 
  },
  { 
    id: 'monthly', 
    title: 'השכרה חודשית קבועה', 
    price: 1300,
    priceDisplay: 'החל מ-1,300 ₪ / חודש', 
    desc: 'שריון 3-5 ימים קבועים בשבוע למשך חודש עד חצי שנה.' 
  },
];

const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי'];

const OCCUPIED_SLOTS = [
  { dayIndex: 2, shift: 'morning' }
];

export default function ClinicBookingApp() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedSubPlanDays, setSelectedSubPlanDays] = useState(3);
  const [selectedDays, setSelectedDays] = useState([]);
  const [dateErrorMsg, setDateErrorMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [currentBookingId, setCurrentBookingId] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', phone: '', profession: '', cardNumber: '', expiry: '', cvv: '' });
  
  const [formErrors, setFormErrors] = useState({});
  const [existingBookings, setExistingBookings] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      if (error) console.error('Error fetching bookings:', error);
      else if (data) setExistingBookings(data);
    } catch (err) {
      console.error('Failed to connect to Supabase:', err);
    }
  };

  const calculateTotalPrice = () => {
    if (!selectedPlan) return 0;
    if (selectedPlan.id === 'monthly') {
      if (selectedSubPlanDays === 3) return 1300;
      if (selectedSubPlanDays === 4) return 1800;
      if (selectedSubPlanDays === 5) return 2000;
    }
    if (selectedPlan.id === 'hourly') {
      return 260;
    }
    return selectedPlan.price;
  };
  
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'נא להזין שם מלא';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'השם חייב להכיל לפחות 2 תווים';
    }

    const phoneClean = formData.phone.replace(/[- ]/g, '');
    const phoneRegex = /^0[2-9]\d{7,8}$/;
    if (!phoneClean) {
      errors.phone = 'נא להזין מספר טלפון';
    } else if (!phoneRegex.test(phoneClean)) {
      errors.phone = 'מספר טלפון אינו תקין (לדוגמה: 0501234567)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // בדיקה האם משמרת ספציפית תפוסה בתאריך מסוים
  const isShiftTaken = (dateStr, shiftStr) => {
    if (!dateStr) return false;

    const isTakenInDb = existingBookings.some((booking) => {
      return booking.selected_date === dateStr && 
             (booking.selected_shift === shiftStr || booking.selected_shift === 'full-day' || shiftStr === 'full-day') &&
             booking.status !== 'cancelled';
    });

    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const isTakenInStatic = OCCUPIED_SLOTS.some(
      slot => slot.dayIndex === dayOfWeek && (slot.shift === shiftStr || slot.shift === 'full-day' || shiftStr === 'full-day')
    );

    return isTakenInDb || isTakenInStatic;
  };

  const handleReserveBooking = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isShiftTaken(selectedDate, selectedShift)) {
      alert('⚠️ המשמרת שבחרת כבר תפוסה!');
      return;
    }

    setIsSaving(true);

    try {
      const totalPrice = calculateTotalPrice();

      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([
        {
          plan_id: selectedPlan.id,
          full_name: formData.name,
          phone: formData.phone,
          profession: formData.profession,
          selected_date: selectedDate || new Date().toISOString().split('T')[0],
          selected_shift: selectedShift || 'full-day',
          total_price: totalPrice,
          status: 'reserved'
        }
      ]).select();

      if (bookingError) throw bookingError;

      if (bookingData && bookingData.length > 0) {
        setCurrentBookingId(bookingData[0].id);
      }

      await supabase.from('orders').insert([
        {
          customer_name: formData.name,
          total_amount: totalPrice,
          status: 'pending'
        }
      ]);

      await fetchBookings();
      setStep(4);
    } catch (err) {
      console.error('❌ שגיאה בשמירה:', err.message);
      alert(`שגיאה בשמירה: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentSuccess = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (currentBookingId) {
        await supabase
          .from('bookings')
          .update({ status: 'paid' })
          .eq('id', currentBookingId);

        await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('customer_name', formData.name);
      }
      setStep(5);
    } catch (err) {
      console.error('❌ שגיאה בעדכון תשלום:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setSelectedDate('');
    setSelectedShift(plan.id === 'daily' ? 'full-day' : '');
    setSelectedDays([]);
    setDateErrorMsg('');
    setStep(2);
  };

  const getSessionDates = (startDateStr) => {
    if (!startDateStr) return [];
    const dates = [];
    let curr = new Date(startDateStr);
    for (let i = 0; i < 4; i++) {
      const d = curr.getDate().toString().padStart(2, '0');
      const m = (curr.getMonth() + 1).toString().padStart(2, '0');
      dates.push(`${d}/${m}`);
      curr.setDate(curr.getDate() + 7);
    }
    return dates;
  };

  const handleDateSelection = (dateStr) => {
    setDateErrorMsg('');
    setSelectedShift('');
    if (!dateStr) {
      setSelectedDate('');
      return;
    }

    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek === 5 || dayOfWeek === 6) {
      setDateErrorMsg('הקליניקה פתוחה בימים א\' עד ה\' בלבד. נא לבחור יום חול.');
      setSelectedDate('');
      return;
    }

    setSelectedDate(dateStr);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div dir="rtl" className="min-h-screen bg-[#fcf9f2] text-[#4a3e3d] font-sans py-8 px-4 flex justify-center items-center">
      <div className="w-full max-w-lg bg-[#faf6ef] rounded-3xl shadow-xl border border-[#e8dfd3] overflow-hidden">
        
        {/* באנר תמונה */}
        <div className="relative h-52 w-full bg-[#ebdcc4]">
          <img 
            src={CLINIC_INFO.imageUrl} 
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80";
            }}
            alt="הקליניקה באביאל" 
            className="w-full h-full object-cover grayscale-[10%] sepia-[15%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2a1b18]/80 via-[#2a1b18]/20 to-transparent flex flex-col justify-end p-6 text-white">
            <span className="text-[11px] font-semibold bg-[#8c5e47] text-[#fbf8f3] px-3 py-1 rounded-full w-fit mb-1.5 shadow-sm">
              🏡 {CLINIC_INFO.address}
            </span>
            <h1 className="text-3xl font-bold title-handwritten tracking-wider text-[#faf4eb]">{CLINIC_INFO.name}</h1>
            <p className="text-xs text-[#ebded5] font-light mt-0.5">{CLINIC_INFO.tagline}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* שלב 1: בחירת מסלול */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-right">
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">בחירת מסלול השכרה</h2>
                <p className="text-xs text-[#8c746c]">בחרי את המסלול המתאים ביותר לאופי הטיפולים שלך</p>
              </div>

              <div className="space-y-3">
                {PLANS.map((plan) => (
                  <div 
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan)}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer text-right ${
                      plan.badge 
                        ? 'border-[#8c5e47] bg-[#fbf5eb] hover:bg-[#faf0df] shadow-sm' 
                        : 'border-[#ebdcc8] bg-[#fcfaf4] hover:border-[#b89b88] hover:shadow-md'
                    }`}
                  >
                    {plan.badge && (
                      <span className="absolute -top-2.5 left-4 bg-[#8c5e47] text-[#fbf8f3] text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                        {plan.badge}
                      </span>
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-[#4a3a35] text-sm">{plan.title}</h3>
                      <span className="text-[#8c5e47] font-extrabold text-xs bg-[#f4ebd9]/80 px-2.5 py-1 rounded-lg">
                        {plan.priceDisplay}
                      </span>
                    </div>
                    <p className="text-xs text-[#735e58] leading-relaxed">{plan.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* שלב 2: בחירת מועד ומשמרת עם תצוגת זמינות ויזואלית */}
          {step === 2 && selectedPlan && (
            <div className="space-y-5 text-right">
              <button 
                onClick={() => setStep(1)} 
                className="text-xs font-semibold text-[#8c5e47] hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← חזרה לבחירת מסלולים
              </button>

              <div>
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">בחירת מועד וזמינות</h2>
                <p className="text-xs text-[#8c746c]">מסלול נבחר: <span className="font-bold text-[#8c5e47]">{selectedPlan.title}</span></p>
              </div>

              {/* ססיה שבועית / השכרה שעתית */}
              {(selectedPlan.id === 'session' || selectedPlan.id === 'hourly') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5c4a45] mb-1.5">1. בחרי תאריך מבוקש (א' - ה'):</label>
                    <input 
                      type="date" 
                      min={todayStr}
                      value={selectedDate}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onChange={(e) => handleDateSelection(e.target.value)}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47] cursor-pointer"
                    />
                  </div>

                  {dateErrorMsg && (
                    <div className="p-3 bg-[#fce8e6] border border-[#f5c2c7] rounded-xl text-xs text-[#c5221f] font-medium flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{dateErrorMsg}</span>
                    </div>
                  )}

                  {/* תצוגת זמינות משמרות ויזואלית ברגע שנבחר תאריך */}
                  {selectedDate && !dateErrorMsg && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-[#5c4a45]">2. בחרי משמרת פנויה בתאריך זה:</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'morning', label: '09:00 - 13:00 (בוקר)' },
                          { id: 'afternoon', label: '13:30 - 17:30 (אחה"צ)' }
                        ].map((shift) => {
                          const taken = isShiftTaken(selectedDate, shift.id);
                          const isSelected = selectedShift === shift.id;

                          return (
                            <button
                              key={shift.id}
                              type="button"
                              disabled={taken}
                              onClick={() => setSelectedShift(shift.id)}
                              className={`p-3 rounded-xl border text-xs font-medium text-center transition-all flex flex-col items-center justify-between gap-1 ${
                                taken 
                                  ? 'bg-stone-200/60 border-stone-300 text-stone-400 cursor-not-allowed line-through' 
                                  : isSelected
                                    ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm cursor-pointer'
                                    : 'border-[#ebdcc4] bg-[#fcfaf4] hover:bg-[#f6ebd9] text-[#5c4a45] cursor-pointer'
                              }`}
                            >
                              <span>{shift.label}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                taken ? 'bg-stone-300 text-stone-600' : isSelected ? 'bg-white/20 text-white' : 'bg-[#f4ebd9] text-[#8c5e47]'
                              }`}>
                                {taken ? 'תפוס במערכת 🔒' : 'פנוי להרשמה ✓'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button 
                    disabled={!selectedDate || !selectedShift}
                    onClick={() => setStep(3)}
                    className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm disabled:bg-[#ebdcc8] disabled:text-[#b8a096] hover:bg-[#724a35] transition-colors shadow-md mt-4 cursor-pointer"
                  >
                    המשך לפרטים ושריון מקום
                  </button>
                </div>
              )}

              {/* השכרה יומית חד-פעמית */}
              {selectedPlan.id === 'daily' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5c4a45] mb-1.5">בחרי תאריך ליום השכרה מלא (א' - ה'):</label>
                    <input 
                      type="date" 
                      min={todayStr}
                      value={selectedDate}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onChange={(e) => handleDateSelection(e.target.value)}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47] cursor-pointer"
                    />
                  </div>

                  {dateErrorMsg && (
                    <div className="p-3 bg-[#fce8e6] border border-[#f5c2c7] rounded-xl text-xs text-[#c5221f] font-medium flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{dateErrorMsg}</span>
                    </div>
                  )}

                  {selectedDate && !dateErrorMsg && (
                    <div className="mt-2">
                      {isShiftTaken(selectedDate, 'full-day') ? (
                        <div className="p-3 bg-[#fce8e6] border border-[#f5c2c7] rounded-xl text-xs text-[#c5221f] font-medium flex items-center gap-2">
                          <span>⚠️</span>
                          <span>היום המלא כבר תפוס במערכת! נא לבחור תאריך אחר.</span>
                        </div>
                      ) : (
                        <div className="p-3 bg-[#e6f4ea] border border-[#b7e1cd] rounded-xl text-xs text-[#137333] font-medium flex items-center gap-2">
                          <span>✓</span>
                          <span>היום המלא פנוי להשכרה!</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-[#f5ebe0] border border-[#ebdcc4] p-3.5 rounded-xl text-xs text-[#5c4a45] space-y-1">
                    <p>🕒 <strong>שעות הפעילות ליום מלא:</strong> 09:00 - 18:00</p>
                    <p className="text-[11px] text-[#8c746c]">הקליניקה תעמוד לרשותך באופן בלעדי לאורך כל היום.</p>
                  </div>

                  <button 
                    disabled={!selectedDate || isShiftTaken(selectedDate, 'full-day')}
                    onClick={() => { setSelectedShift('full-day'); setStep(3); }}
                    className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm disabled:bg-[#ebdcc8] disabled:text-[#b8a096] hover:bg-[#724a35] transition-colors shadow-md mt-2 cursor-pointer"
                  >
                    המשך לפרטים ושריון מקום
                  </button>
                </div>
              )}

              {/* השכרה חודשית קבועה */}
              {selectedPlan.id === 'monthly' && (
                <div className="space-y-4">
                  <div className="space-y-2 bg-[#f5ebe0] p-3.5 rounded-2xl border border-[#ebdcc4]">
                    <label className="block text-xs font-bold text-[#5c4a45]">1. בחרי היקף ימים בשבוע:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { days: 3, label: '3 ימים (1,300 ₪)' },
                        { days: 4, label: '4 ימים (1,800 ₪)' },
                        { days: 5, label: '5 ימים (2,000 ₪)' }
                      ].map((item) => (
                        <button
                          key={item.days}
                          type="button"
                          onClick={() => {
                            setSelectedSubPlanDays(item.days);
                            setSelectedDays([]);
                          }}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                            selectedSubPlanDays === item.days 
                              ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm' 
                              : 'border-[#ebd8c0] bg-white text-[#5c4a45] hover:bg-stone-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#5c4a45]">2. בחרי משמרת קבועה:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'morning', label: '09:00 - 13:00 (בוקר)' },
                        { id: 'afternoon', label: '13:30 - 17:30 (אחה"צ)' }
                      ].map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setSelectedShift(shift.id)}
                          className={`p-3 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer ${
                            selectedShift === shift.id 
                              ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm' 
                              : 'border-[#ebdcc4] bg-[#fcfaf4] hover:bg-[#f6ebd9] text-[#5c4a45]'
                          }`}
                        >
                          {shift.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedShift && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-[#5c4a45]">
                          3. סמני {selectedSubPlanDays} ימים קבועים בשבוע:
                        </label>
                        <span className="text-[11px] text-[#8c5e47] font-semibold">
                          ({selectedDays.length} / {selectedSubPlanDays} נבחרו)
                        </span>
                      </div>

                      <div className="space-y-2">
                        {DAY_NAMES.map((dayName, idx) => {
                          const isOccupied = OCCUPIED_SLOTS.some(s => s.dayIndex === idx && s.shift === selectedShift);
                          const isSelected = selectedDays.includes(idx);

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={isOccupied}
                              onClick={() => {
                                if (selectedDays.includes(idx)) {
                                  setSelectedDays(selectedDays.filter(d => d !== idx));
                                } else if (selectedDays.length < selectedSubPlanDays) {
                                  setSelectedDays([...selectedDays, idx]);
                                }
                              }}
                              className={`w-full p-3 rounded-xl border text-xs font-medium flex justify-between items-center transition-all cursor-pointer ${
                                isOccupied 
                                  ? 'bg-stone-200/60 border-stone-300 text-stone-400 cursor-not-allowed line-through' 
                                  : isSelected
                                    ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm'
                                    : 'border-[#ebdcc4] bg-[#fcfaf4] hover:bg-[#f6ebd9] text-[#5c4a45]'
                              }`}
                            >
                              <span>{dayName}</span>
                              {isOccupied ? (
                                <span className="text-[10px] bg-stone-300 text-stone-600 px-2 py-0.5 rounded">תפוס במערכת 🔒</span>
                              ) : isSelected ? (
                                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded">נבחר ✓</span>
                              ) : (
                                <span className="text-[10px] text-[#8c5e47]">פנוי להרשמה</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button 
                    disabled={selectedDays.length !== selectedSubPlanDays || !selectedShift}
                    onClick={() => setStep(3)}
                    className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm disabled:bg-[#ebdcc8] disabled:text-[#b8a096] hover:bg-[#724a35] transition-colors shadow-md mt-4 cursor-pointer"
                  >
                    המשך לפרטים ושריון מקום
                  </button>
                </div>
              )}

            </div>
          )}

          {/* שלב 3: מילוי פרטים ושריון הזמנה */}
          {step === 3 && (
            <form onSubmit={handleReserveBooking} className="space-y-4 text-right">
              <button 
                type="button"
                onClick={() => setStep(2)} 
                className="text-xs font-semibold text-[#8c5e47] hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← חזרה לבחירת זמנים ({selectedPlan?.title})
              </button>

              <div>
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">פרטי המזמין/ה</h2>
                <p className="text-xs text-[#8c746c]">הזיני את פרטייך לשריון התור לפני תשלום</p>
              </div>

              <div className="space-y-3">
                <div>
                  <input 
                    type="text" 
                    placeholder="שם מלא *" 
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      if (formErrors.name) setFormErrors({...formErrors, name: ''});
                    }}
                    className={`w-full p-3 border rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47] ${
                      formErrors.name ? 'border-red-500 bg-red-50/30' : 'border-[#cbd5e1]'
                    }`} 
                  />
                  {formErrors.name && <p className="text-red-500 text-[11px] mt-1 mr-1">{formErrors.name}</p>}
                </div>

                <div>
                  <input 
                    type="tel" 
                    placeholder="מספר טלפון נייד * (לדוגמה: 0501234567)" 
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({...formData, phone: e.target.value});
                      if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                    }}
                    className={`w-full p-3 border rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47] ${
                      formErrors.phone ? 'border-red-500 bg-red-50/30' : 'border-[#cbd5e1]'
                    }`} 
                  />
                  {formErrors.phone && <p className="text-red-500 text-[11px] mt-1 mr-1">{formErrors.phone}</p>}
                </div>

                <input 
                  type="text" 
                  placeholder="תחום טיפול (פסיכותרפיה, רפואה משלימה וכו')" 
                  value={formData.profession}
                  onChange={(e) => setFormData({...formData, profession: e.target.value})}
                  className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47]" 
                />
              </div>

              {/* סיכום פרטי שריון */}
              <div className="bg-[#f5ebe0] border border-[#ebdcc4] p-4 rounded-2xl text-xs text-[#5c4a45] space-y-2 mt-4">
                <div className="font-bold border-b border-[#ebdcc4] pb-1.5 text-[#3b2a26] flex justify-between items-center">
                  <span>📋 סיכום פרטי השריון</span>
                  <span className="text-sm font-extrabold text-[#8c5e47]">{calculateTotalPrice().toLocaleString()} ₪</span>
                </div>
                <p>📍 <strong>מיקום:</strong> הקליניקה באביאל</p>
                <p>💳 <strong>מסלול:</strong> {selectedPlan.title}</p>
                
                {selectedPlan.id === 'session' && (
                  <>
                    <p>🗓️ <strong>יום בשבוע:</strong> {selectedDate ? DAY_NAMES[new Date(selectedDate).getDay()] : ''}</p>
                    <p className="bg-white/70 p-2 rounded-lg border border-[#ebdcc4] text-[#8c5e47] font-semibold">
                      📅 <strong>4 תאריכי הפעילות:</strong> {getSessionDates(selectedDate).join(', ')}
                    </p>
                    <p>⏰ <strong>משמרת:</strong> {selectedShift === 'morning' ? '09:00 - 13:00 (בוקר)' : '13:30 - 17:30 (אחה"צ)'}</p>
                  </>
                )}

                {selectedPlan.id === 'daily' && (
                  <>
                    <p>🗓️ <strong>תאריך:</strong> {selectedDate}</p>
                    <p>⏰ <strong>שעות:</strong> 09:00 - 18:00 (יום מלא)</p>
                  </>
                )}

                {selectedPlan.id === 'monthly' && (
                  <>
                    <p>📅 <strong>ימים קבועים ({selectedSubPlanDays} בשבוע):</strong> {selectedDays.map(d => DAY_NAMES[d]).join(', ')}</p>
                    <p>⏰ <strong>משמרת:</strong> {selectedShift === 'morning' ? '09:00 - 13:00 (בוקר)' : '13:30 - 17:30 (אחה"צ)'}</p>
                  </>
                )}

                <div className="pt-2 border-t border-[#ebdcc4] flex justify-between items-center font-bold text-sm text-[#4a3a35]">
                  <span>סה"כ לתשלום:</span>
                  <span className="text-base text-[#8c5e47]">{calculateTotalPrice().toLocaleString()} ₪</span>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm hover:bg-[#724a35] transition-all shadow-md mt-3 cursor-pointer disabled:bg-stone-300"
              >
                {isSaving ? 'שומר במערכת...' : 'אישור ושריון מקום – המשך לתשלום ←'}
              </button>
            </form>
          )}

          {/* שלב 4: מסך התשלום המאובטח */}
          {step === 4 && (
            <form onSubmit={handlePaymentSuccess} className="space-y-4 text-right">
              <button 
                type="button"
                onClick={() => setStep(3)} 
                className="text-xs font-semibold text-[#8c5e47] hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← חזרה לעריכת פרטים
              </button>

              <div>
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">תשלום מאובטח</h2>
                <p className="text-xs text-[#8c746c]">המקום שוריין עבורך. השלימי את התשלום להנפקת קבלה</p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#5c4a45]">בחרי אמצעי תשלום:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'credit', label: '💳 אשראי' },
                    { id: 'bit', label: '📲 Bit' },
                    { id: 'bank', label: '🏦 העברה' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === method.id 
                          ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm' 
                          : 'border-[#ebdcc4] bg-[#fcfaf4] hover:bg-[#f6ebd9] text-[#5c4a45]'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'credit' && (
                  <div className="space-y-2.5 bg-[#fcfaf4] p-3.5 rounded-xl border border-[#ebdcc4]">
                    <input 
                      type="text" 
                      required
                      placeholder="מספר כרטיס אשראי *" 
                      value={formData.cardNumber}
                      onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
                      className="w-full p-2.5 border border-[#cbd5e1] rounded-lg text-xs bg-white text-[#4a3e3d]" 
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="text" 
                        required
                        placeholder="תוקף (MM/YY) *" 
                        value={formData.expiry}
                        onChange={(e) => setFormData({...formData, expiry: e.target.value})}
                        className="p-2.5 border border-[#cbd5e1] rounded-lg text-xs bg-white text-[#4a3e3d]" 
                      />
                      <input 
                        type="text" 
                        required
                        placeholder="CVV *" 
                        value={formData.cvv}
                        onChange={(e) => setFormData({...formData, cvv: e.target.value})}
                        className="p-2.5 border border-[#cbd5e1] rounded-lg text-xs bg-white text-[#4a3e3d]" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#f5ebe0] p-3 rounded-xl border border-[#ebdcc4] flex justify-between items-center text-xs text-[#5c4a45] font-bold">
                <span>לתשלום כעת:</span>
                <span className="text-sm text-[#8c5e47]">{calculateTotalPrice().toLocaleString()} ₪</span>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm hover:bg-[#724a35] transition-all shadow-md mt-2 cursor-pointer disabled:bg-stone-300"
              >
                {isSaving ? 'מעבד תשלום...' : `אישור תשלום בסך ${calculateTotalPrice().toLocaleString()} ₪ 🔒`}
              </button>
            </form>
          )}

          {/* שלב 5: מסך אישור הצלחה */}
          {step === 5 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-[#f4ebd9] text-[#8c5e47] rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-sm">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-[#5c4a45] title-handwritten">ההזמנה והתשלום נקלטו בהצלחה!</h2>
              <p className="text-xs text-stone-600 max-w-xs mx-auto leading-relaxed">
                תודה <strong>{formData.name}</strong>, אישור ההזמנה וקבלה על סך <strong>{calculateTotalPrice().toLocaleString()} ₪</strong> נשלחו אלייך. יומן הקליניקה סונכרן אוטומטית מול מסד הנתונים.
              </p>

              <button 
                onClick={() => {
                  setStep(1);
                  setSelectedPlan(null);
                  setSelectedDate('');
                  setSelectedShift('');
                  setFormData({ name: '', phone: '', profession: '', cardNumber: '', expiry: '', cvv: '' });
                }}
                className="bg-[#4a3a35] text-[#fbf8f3] px-8 py-3 rounded-xl font-semibold text-xs hover:bg-[#322521] transition-all shadow-md mt-2 cursor-pointer"
              >
                חזרה לעמוד הראשי
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}