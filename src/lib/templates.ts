import gastronomia from "@/assets/tpl-gastronomia.jpg";
import servicos from "@/assets/tpl-servicos.jpg";
import produtos from "@/assets/tpl-produtos.jpg";

export type Archetype = "gastronomia" | "servicos" | "produtos";

export const TEMPLATES: {
  id: Archetype;
  name: string;
  segment: string;
  image: string;
  sections: string[];
}[] = [
  {
    id: "gastronomia",
    name: "Gastronomia",
    segment: "Restaurantes, bares, cafés e delivery",
    image: gastronomia,
    sections: ["Hero fotográfico", "Cardápio por categorias", "Horários e localização", "Pedido via WhatsApp", "Galeria"],
  },
  {
    id: "servicos",
    name: "Serviços",
    segment: "Clínicas, escritórios, estética e profissionais liberais",
    image: servicos,
    sections: ["Hero de confiança", "Serviços e benefícios", "Diferenciais", "Perguntas frequentes", "Área de atendimento"],
  },
  {
    id: "produtos",
    name: "Produtos e varejo",
    segment: "Lojas, marcas e catálogos",
    image: produtos,
    sections: ["Vitrine visual", "Categorias", "Destaques", "Consulta por WhatsApp", "Galeria de produtos"],
  },
];
