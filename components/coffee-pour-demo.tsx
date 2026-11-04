import { CoffeePourMenu, type CoffeeItem } from "@/components/ui/coffee-pour-menu";

const items: CoffeeItem[] = [
  {
    id: "espresso",
    name: "Espresso",
    subtitle: "30 ml · bold",
    description: "a short, intense shot with golden crema",
    vessel: "demitasse",
    layers: [{ type: "espresso", amount: 0.72 }],
    crema: true,
  },
  {
    id: "americano",
    name: "Americano",
    subtitle: "240 ml · smooth",
    description: "espresso over hot water",
    vessel: "glass-mug",
    layers: [
      { type: "water", amount: 0.54 },
      { type: "espresso", amount: 0.24 },
    ],
    crema: true,
    blend: 0.9,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    subtitle: "180 ml · velvety",
    description: "espresso with steamed milk and foam",
    vessel: "cup",
    layers: [
      { type: "espresso", amount: 0.3 },
      { type: "milk", amount: 0.44 },
    ],
    foam: 0.14,
    art: "heart",
  },
  {
    id: "latte",
    name: "Latte",
    subtitle: "300 ml · mellow",
    description: "espresso with lots of steamed milk and microfoam",
    vessel: "tall-glass",
    layers: [
      { type: "espresso", amount: 0.25 },
      { type: "milk", amount: 0.51 },
    ],
    foam: 0.11,
    blend: 0.15,
  },
];

export default function CoffeePourMenuDemo() {
  return (
    <div className="pour-experience">
      <CoffeePourMenu items={items} defaultValue="cappuccino" />
      <p className="pour-hint">
        by{" "}
        <a
          href="https://aakashmehra.com/ref/coffeepourmenu"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          aakashmehra.com
        </a>
      </p>
    </div>
  );
}
