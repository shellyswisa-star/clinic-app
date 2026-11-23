import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  CLINIC_INFO,
  DAY_NAMES,
  DEFAULT_PRICING,
  buildPlans,
  calcPlanTotal,
  isSlotBlocked,
} from './clinicConfig';
import {
  canStartSave,
  isShiftTaken as checkShiftTaken,
  validateBookingForm,
} from './lib/bookingRules';
import { createBookingSafe, mapBookingError } from './lib/bookingApi';
import { buildSeriesLabel, newSeriesId } from './lib/bookingSeries';
import {
  MONTHLY_DURATION_OPTIONS,
  PARTIAL_SHIFTS,
  SHIFT_WINDOWS,
  formatDateHe,
  formatMonthRangeHe,
  getMonthlyConcreteDates,
  getSessionDates as buildSessionDates,
} from './lib/schedule';
import AlertBanner from './components/AlertBanner.jsx';
import LandingPage from './components/LandingPage.jsx';
import PersonalArea from './components/PersonalArea.jsx';

export default function ClinicBookingApp() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedSubPlanDays, setSelectedSubPlanDays] = useState(3);
  const [selectedDays, setSelectedDays] = useState([]);
  const [monthlyStartDate, setMonthlyStartDate] = useState('');
  const [monthlyMonths, setMonthlyMonths] = useState(1);
  const [dateErrorMsg, setDateErrorMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [currentBookingId, setCurrentBookingId] = useState(null);
  const [currentBookingIds, setCurrentBookingIds] = useState([]);
  // 0 = נחיתה, 1 = מסלולים, 2 = מועד, 3 = פרטים, 4 = תשלום, 5 = הצלחה, 6 = אזור אישי
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ name: '', phone: '', profession: '', cardNumber: '', expiry: '', cvv: '' });
  
  const [formErrors, setFormErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [existingBookings, setExistingBookings] = useState([]);
  const [pricingRows, setPricingRows] = useState(DEFAULT_PRICING);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const plans = useMemo(() => buildPlans(pricingRows), [pricingRows]);

  useEffect(() => {
    fetchBookings();
    fetchPricing();
    fetchBlockedSlots();
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;
    const updated = plans.find((p) => p.id === selectedPlan.id);
    if (updated && updated.priceDisplay !== selectedPlan.priceDisplay) {
      setSelectedPlan(updated);
    }
  }, [plans, selectedPlan]);

  const handleCancelCurrentBooking = async () => {
    if (!currentBookingId) return;

    const id = currentBookingId;
    setCurrentBookingId(null);

    const { data: deleted, error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .select();

    // בלי מדיניות DELETE, סופבייס מחזיר הצלחה בלי למחוק שורה
    if (deleteError || !deleted?.length) {
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select();

      if (updateError || !updated?.length) {
        console.error('שגיאה בביטול השריון הזמני:', deleteError || updateError);
        alert('לא הצלחנו לשחרר את המשמרת. בסופבייס חסרה הרשאת מחיקה או עדכון לטבלת bookings.');
      }
    }

    await fetchBookings();
  };

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      if (error) console.error('Error fetching bookings:', error);
      else if (data) setExistingBookings(data);
    } catch (err) {
      console.error('Failed to connect to Supabase:', err);
    }
  };

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Error fetching pricing:', error);
        return;
      }
      if (data?.length) setPricingRows(data);
    } catch (err) {
      console.error('Failed to load pricing:', err);
    }
  };

  const fetchBlockedSlots = async () => {
    try {
      const { data, error } = await supabase.from('blocked_slots').select('*');
      if (error) {
        console.error('Error fetching blocked slots:', error);
        return;
      }
      if (data) setBlockedSlots(data);
    } catch (err) {
      console.error('Failed to load blocked slots:', err);
    }
  };

  const calculateTotalPrice = () => {
    if (!selectedPlan) return 0;
    return calcPlanTotal(selectedPlan.id, pricingRows, {
      subPlanDays: selectedSubPlanDays,
      months: selectedPlan.id === 'monthly' ? monthlyMonths : 1,
    });
  };
  
  const validateForm = () => {
    const { ok, errors } = validateBookingForm(formData);
    setFormErrors(errors);
    return ok;
  };

  const isShiftTaken = (dateStr, shiftStr) =>
    checkShiftTaken({
      dateStr,
      shiftStr,
      existingBookings,
      blockedSlots,
    });

  const monthlyConcreteDates = useMemo(() => {
    if (selectedPlan?.id !== 'monthly') return [];
    if (selectedDays.length !== selectedSubPlanDays) return [];
    if (!monthlyStartDate) return [];
    return getMonthlyConcreteDates(selectedDays, {
      startDateStr: monthlyStartDate,
      months: monthlyMonths,
    });
  }, [selectedPlan?.id, selectedDays, selectedSubPlanDays, monthlyStartDate, monthlyMonths]);

  const monthlyDatesAvailability = useMemo(
    () =>
      monthlyConcreteDates.map((dateStr) => ({
        dateStr,
        taken: isShiftTaken(dateStr, selectedShift || 'morning'),
      })),
    // isShiftTaken closes over bookings/blocks — refresh when those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthlyConcreteDates, selectedShift, existingBookings, blockedSlots],
  );

  const monthlyAllFree =
    monthlyDatesAvailability.length > 0 &&
    monthlyDatesAvailability.every((d) => !d.taken);

  const handleReserveBooking = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!validateForm()) return;
    if (!canStartSave({ isSaving })) return;

    const shift = selectedShift || 'full-day';
    const datesToBook =
      selectedPlan.id === 'monthly'
        ? monthlyConcreteDates
        : selectedPlan.id === 'session'
          ? buildSessionDates(selectedDate)
          : [selectedDate || new Date().toISOString().split('T')[0]];

    if (!datesToBook.length) {
      setActionError('חסרים תאריכים לשריון. חזרי לבחירת מועדים.');
      return;
    }

    const blocked = datesToBook.find((d) => isShiftTaken(d, shift));
    if (blocked) {
      setActionError(`המועד ${formatDateHe(blocked)} כבר תפוס. שני בחירה ביומן.`);
      return;
    }

    setIsSaving(true);

    try {
      const totalPrice = calculateTotalPrice();
      const createdIds = [];
      const seriesId = datesToBook.length > 1 ? newSeriesId() : null;
      const seriesLabel =
        datesToBook.length > 1
          ? buildSeriesLabel({
              planId: selectedPlan.id,
              weekdays: selectedPlan.id === 'monthly' ? selectedDays : [],
              shift,
              startDateStr:
                selectedPlan.id === 'monthly' ? monthlyStartDate : datesToBook[0],
              months: selectedPlan.id === 'monthly' ? monthlyMonths : undefined,
              dates: datesToBook,
            })
          : null;

      for (let i = 0; i < datesToBook.length; i += 1) {
        const { data: bookingData, error: bookingError } = await createBookingSafe({
          plan_id: selectedPlan.id,
          full_name: formData.name,
          phone: formData.phone,
          profession: formData.profession,
          selected_date: datesToBook[i],
          selected_shift: shift,
          // מחיר מלא רק בהזמנה הראשונה — השאר מחזיקות משבצת
          total_price: i === 0 ? totalPrice : 0,
          status: 'reserved',
          series_id: seriesId,
          series_label: seriesLabel,
        });

        if (bookingError) {
          throw new Error(mapBookingError(bookingError));
        }
        if (bookingData?.id) createdIds.push(bookingData.id);
      }

      setCurrentBookingIds(createdIds);
      setCurrentBookingId(createdIds[0] || null);

      const { error: orderError } = await supabase.from('orders').insert([
        {
          customer_name: formData.name,
          total_amount: totalPrice,
          status: 'pending',
        },
      ]);
      if (orderError) {
        throw new Error(mapBookingError(orderError));
      }

      await fetchBookings();
      setActionError('');
      setStep(4);
    } catch (err) {
      console.error('❌ שגיאה בשמירה:', err.message);
      setActionError(err.message || 'שגיאה בשמירת ההזמנה');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentSuccess = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!canStartSave({ isSaving })) return;
    setIsSaving(true);

    try {
      const ids = currentBookingIds.length ? currentBookingIds : currentBookingId ? [currentBookingId] : [];
      if (ids.length) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ status: 'paid' })
          .in('id', ids);
        if (bookingError) throw bookingError;

        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('customer_name', formData.name);
        if (orderError) throw orderError;
      }
      setActionError('');
      setStep(5);
    } catch (err) {
      console.error('❌ שגיאה בעדכון תשלום:', err);
      setActionError(mapBookingError(err) || 'עדכון התשלום נכשל. נסי שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setSelectedDate('');
    setSelectedShift(plan.id === 'daily' ? 'full-day' : '');
    setSelectedDays([]);
    setMonthlyStartDate('');
    setMonthlyMonths(1);
    setDateErrorMsg('');
    setStep(2);
  };

  const handleMonthlyStartDate = (dateStr) => {
    setDateErrorMsg('');
    if (!dateStr) {
      setMonthlyStartDate('');
      return;
    }
    const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      setDateErrorMsg('הקליניקה פתוחה בימים א\' עד ה\' בלבד. נא לבחור יום חול להתחלה.');
      setMonthlyStartDate('');
      return;
    }
    setMonthlyStartDate(dateStr);
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

  if (step === 0) {
    return (
      <LandingPage
        onStartBooking={() => setStep(1)}
        onOpenPersonalArea={() => setStep(6)}
      />
    );
  }

  if (step === 6) {
    return <PersonalArea onBack={() => setStep(0)} />;
  }

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
              {CLINIC_INFO.address}
            </span>
            <h1 className="text-3xl font-bold title-handwritten tracking-wider text-[#faf4eb]">{CLINIC_INFO.name}</h1>
            <p className="text-xs text-[#ebded5] font-light mt-0.5">{CLINIC_INFO.tagline}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* שלב 1: בחירת מסלול */}
          {step === 1 && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-xs font-semibold text-[#8c5e47] hover:underline cursor-pointer"
              >
                ← חזרה
              </button>
              <div className="text-right">
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">בחירת מסלול השכרה</h2>
                <p className="text-xs text-[#8c746c]">בחרי את המסלול המתאים ביותר לאופי הטיפולים שלך</p>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
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
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="font-bold text-[#4a3a35] text-sm">{plan.title}</h3>
                      <div className="text-left shrink-0">
                        <span className="text-[#8c5e47] font-extrabold text-xs bg-[#f4ebd9]/80 px-2.5 py-1 rounded-lg inline-block">
                          {plan.priceDisplay}
                        </span>
                        {plan.priceHint && (
                          <p className="text-[10px] text-[#8c746c] mt-1">{plan.priceHint}</p>
                        )}
                      </div>
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

              {/* מפגש שבועי / השכרה שעתית */}
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
                        {PARTIAL_SHIFTS.map((shift) => {
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
                                {taken ? 'תפוס במערכת' : 'פנוי להרשמה'}
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
                    <p>🕒 <strong>שעות הפעילות ליום מלא:</strong> {SHIFT_WINDOWS['full-day'].short}</p>
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
                      {[3, 4, 5].map((days) => {
                        const amount = calcPlanTotal('monthly', pricingRows, { subPlanDays: days });
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setSelectedSubPlanDays(days);
                              setSelectedDays([]);
                            }}
                            className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              selectedSubPlanDays === days
                                ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm'
                                : 'border-[#ebd8c0] bg-white text-[#5c4a45] hover:bg-stone-50'
                            }`}
                          >
                            {days} ימים ({amount.toLocaleString()} ₪)
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#5c4a45]">2. בחרי משמרת קבועה:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PARTIAL_SHIFTS.map((shift) => (
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
                          const isOccupied = isSlotBlocked(blockedSlots, {
                            dayIndex: idx,
                            shift: selectedShift,
                          });
                          const isSelected = selectedDays.includes(idx);

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={isOccupied}
                              onClick={() => {
                                if (selectedDays.includes(idx)) {
                                  setSelectedDays(selectedDays.filter((d) => d !== idx));
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
                                <span className="text-[10px] bg-stone-300 text-stone-600 px-2 py-0.5 rounded">חסום קבוע</span>
                              ) : isSelected ? (
                                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded">נבחר</span>
                              ) : (
                                <span className="text-[10px] text-[#8c5e47]">לבחירה</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedShift && selectedDays.length === selectedSubPlanDays && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#5c4a45] mb-1.5">
                          4. החל מאיזה תאריך מתחילים?
                        </label>
                        <input
                          type="date"
                          min={todayStr}
                          value={monthlyStartDate}
                          data-testid="monthly-start-date"
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={(e) => handleMonthlyStartDate(e.target.value)}
                          className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47] cursor-pointer"
                        />
                      </div>

                      {dateErrorMsg && (
                        <AlertBanner tone="error">{dateErrorMsg}</AlertBanner>
                      )}

                      {monthlyStartDate && !dateErrorMsg && (
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-[#5c4a45]">
                            5. לכמה חודשים?
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {MONTHLY_DURATION_OPTIONS.map((opt) => (
                              <button
                                key={opt.months}
                                type="button"
                                onClick={() => setMonthlyMonths(opt.months)}
                                className={`p-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                                  monthlyMonths === opt.months
                                    ? 'border-[#8c5e47] bg-[#8c5e47] text-white shadow-sm'
                                    : 'border-[#ebd8c0] bg-white text-[#5c4a45] hover:bg-stone-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-[#8c746c]">
                            סה״כ לתקופה:{' '}
                            <strong className="text-[#8c5e47]">
                              {calcPlanTotal('monthly', pricingRows, {
                                subPlanDays: selectedSubPlanDays,
                                months: monthlyMonths,
                              }).toLocaleString()}{' '}
                              ₪
                            </strong>
                            {' · '}
                            {formatMonthRangeHe(monthlyStartDate, monthlyMonths)}
                          </p>
                        </div>
                      )}

                      {monthlyStartDate && !dateErrorMsg && (
                        <div className="space-y-2" data-testid="monthly-calendar-sync">
                          <label className="block text-xs font-bold text-[#5c4a45]">
                            6. תאריכים מהיומן ({monthlyConcreteDates.length} מועדים):
                          </label>
                          <p className="text-[11px] text-[#8c746c]">
                            אלה המועדים שישורינו בפועל. אפשר להמשיך רק אם כולם פנויים.
                          </p>
                          <ul className="bg-white border border-[#e8dfd3] rounded-xl divide-y divide-[#eee4d8] max-h-48 overflow-y-auto">
                            {monthlyDatesAvailability.map(({ dateStr, taken }) => (
                              <li
                                key={dateStr}
                                className={`px-3 py-2 text-xs flex justify-between gap-2 ${
                                  taken ? 'text-red-700 bg-red-50/50' : 'text-[#5c4a45]'
                                }`}
                              >
                                <span>{formatDateHe(dateStr)}</span>
                                <span className="font-semibold">{taken ? 'תפוס' : 'פנוי'}</span>
                              </li>
                            ))}
                          </ul>
                          {!monthlyAllFree && monthlyConcreteDates.length > 0 && (
                            <AlertBanner tone="error">
                              חלק מהתאריכים תפוסים. שני ימים בשבוע, משמרת, תאריך התחלה או משך.
                            </AlertBanner>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    disabled={
                      selectedDays.length !== selectedSubPlanDays ||
                      !selectedShift ||
                      !monthlyStartDate ||
                      !monthlyAllFree
                    }
                    onClick={() => {
                      setSelectedDate(monthlyStartDate || monthlyConcreteDates[0] || '');
                      setStep(3);
                    }}
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
                onClick={async () => {
                  await handleCancelCurrentBooking();
                  setStep(2);
                }}
                className="text-xs font-semibold text-[#8c5e47] hover:underline flex items-center gap-1 cursor-pointer"
              > 
                ← חזרה לבחירת זמנים ({selectedPlan?.title})
              </button>

              <div>
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">פרטי המזמין/ה</h2>
                <p className="text-xs text-[#8c746c]">הזיני את פרטייך לשריון התור לפני תשלום</p>
              </div>

              {actionError && (
                <AlertBanner tone="error" testId="booking-action-error">
                  {actionError}
                </AlertBanner>
              )}

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
                
                {selectedPlan.id === 'hourly' && (
                  <>
                    <p>🗓️ <strong>תאריך:</strong> {formatDateHe(selectedDate)}</p>
                    <p>⏰ <strong>משמרת:</strong> {SHIFT_WINDOWS[selectedShift]?.label || selectedShift}</p>
                  </>
                )}

                {selectedPlan.id === 'session' && (
                  <>
                    <p>🗓️ <strong>יום בשבוע:</strong> {selectedDate ? DAY_NAMES[new Date(`${selectedDate}T12:00:00`).getDay()] : ''}</p>
                    <p className="bg-white/70 p-2 rounded-lg border border-[#ebdcc4] text-[#8c5e47] font-semibold">
                      📅 <strong>4 תאריכי הפעילות:</strong>{' '}
                      {buildSessionDates(selectedDate).map(formatDateHe).join(', ')}
                    </p>
                    <p>⏰ <strong>משמרת:</strong> {SHIFT_WINDOWS[selectedShift]?.label || selectedShift}</p>
                  </>
                )}

                {selectedPlan.id === 'daily' && (
                  <>
                    <p>🗓️ <strong>תאריך:</strong> {formatDateHe(selectedDate)}</p>
                    <p>⏰ <strong>שעות:</strong> {SHIFT_WINDOWS['full-day'].label}</p>
                  </>
                )}

                {selectedPlan.id === 'monthly' && (
                  <>
                    <p>📅 <strong>ימים קבועים ({selectedSubPlanDays} בשבוע):</strong> {selectedDays.map((d) => DAY_NAMES[d]).join(', ')}</p>
                    <p>⏰ <strong>משמרת:</strong> {SHIFT_WINDOWS[selectedShift]?.label || selectedShift}</p>
                    <p>
                      🗓️ <strong>תקופה:</strong>{' '}
                      {formatMonthRangeHe(monthlyStartDate, monthlyMonths)}
                      {' · '}
                      {monthlyMonths === 1 ? 'חודש אחד' : `${monthlyMonths} חודשים`}
                    </p>
                    <p className="bg-white/70 p-2 rounded-lg border border-[#ebdcc4] text-[#8c5e47] font-semibold leading-relaxed">
                      {monthlyConcreteDates.length} תאריכים שישורינו:{' '}
                      {monthlyConcreteDates.map(formatDateHe).join(' · ')}
                    </p>
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
                onClick={async () => {
                  await handleCancelCurrentBooking();
                  setStep(3);
                }}
                className="text-xs font-semibold text-[#8c5e47] hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← חזרה לעריכת פרטים
              </button>

              <div>
                <h2 className="text-xl font-bold text-[#5c4a45] title-handwritten tracking-wide">תשלום מאובטח</h2>
                <p className="text-xs text-[#8c746c]">המקום שוריין עבורך. השלימי את התשלום להנפקת קבלה</p>
              </div>

              {actionError && (
                <AlertBanner tone="error" testId="booking-action-error">
                  {actionError}
                </AlertBanner>
              )}

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