import { ItemCard } from "../../components/dashboard/ItemCard"
import { Grid } from "../../components/Grid"
import { prisma } from "@/.server/db"
import type { Route } from "./+types/item"

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader 
  const itemId = params["*"]
  const item = await prisma.item.findUniqueOrThrow({
    where: {
      id: itemId,
      type: "folder"
    },
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      children: {
        include: {
          thumbnails: {
            where: {
              size: {
                equals: "medium"
              }
            }
          }
        },
      },
      _count: {
        select: {
          children: true,
        },
      },
    },
  });
  console.log("Loaded item:", item);
  return { item };
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null;
}

export default ({ loaderData }: Route.ComponentProps) => {
  const item = loaderData.item;
  return (
    <Grid>
      {item?.children?.map((child) => (
        <ItemCard
          key={child.id}
          id={child.id}
          to={`/dashboard/items/${child.id}`}
          name={child.name}
          type={child.type}
          size={child.size}
          className="bg-sidebar"
          thumbnail={
            child.type === 'file' && child?.thumbnails?.[0]?.url ? child.thumbnails[0].url : ''
          }
          favorited={false}
        />
      ))}
    </Grid>
  );
};