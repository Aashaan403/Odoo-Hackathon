import { useNavigate } from 'react-router-dom';
import { useLookups, useWorkspace } from '../../lib/api.js';
import { formatDate, intervalLabel, isoToday, money } from '../../lib/format.js';
import { Button } from '../../components/Button.jsx';
import { Loading, PageHeader } from '../../components/Layout.jsx';

export default function Plans() {
  const { data, isLoading } = useWorkspace();
  const lookups = useLookups(data);
  const navigate = useNavigate();
  if (isLoading || !lookups) return <Loading />;
  const today = isoToday();
  const plans = data.plans.filter((plan) => plan.active && plan.availableFrom <= today && (!plan.availableTo || plan.availableTo >= today));

  return (
    <div>
      <PageHeader title="Plans" description="Prices are per unit for each billing period, before tax. You can add extras like priority support when you subscribe." />
      <div className="grid border-l border-line sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const product = lookups.products.get(plan.productId);
          const rules = [plan.allowPause && 'Pause any time', plan.allowEarlyClose ? 'Cancel any time' : 'Fixed term', plan.allowRenew && 'Renew when it ends'].filter(Boolean);
          return (
            <article key={plan.id} className="flex flex-col gap-6 border-r border-b border-line p-6 sm:p-8">
              <div>
                <h2 className="text-title font-semibold">{plan.name}</h2>
                <p className="text-body text-mute">{product?.name}</p>
              </div>
              <p className="figure text-figure font-extrabold">{money(plan.price)}<span className="ml-1 text-body font-medium text-mute" style={{ fontStretch: '100%', letterSpacing: 0 }}>per unit, every {intervalLabel[plan.interval]}</span></p>
              <ul className="flex flex-col gap-2 border-t border-line pt-4 text-body">
                <li>{plan.minQuantity > 1 ? `From ${plan.minQuantity} units` : 'From a single unit'}</li>
                {rules.map((rule) => <li key={rule}>{rule}</li>)}
                {plan.availableTo && <li className="text-plum">Available until {formatDate(plan.availableTo)}</li>}
              </ul>
              <Button className="mt-auto" onClick={() => navigate(`/subscriptions?new=1&plan=${plan.id}`)}>Choose {plan.name}</Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
