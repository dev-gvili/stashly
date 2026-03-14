import type { Route } from './+types/file'
import { prisma } from '@/services/db'
import {
  useLocation,
  useNavigate,
  type LinkProps,
  type UIMatch,
} from 'react-router'
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Link } from 'react-router'
import { href } from 'react-router'
import { getBreadcrumbs } from '@/services/breadcrumbs'

export async function loader({ request, params }: Route.LoaderArgs) {
  let crumbs = await getBreadcrumbs(params.fileId)
  const item = await prisma.item.findUniqueOrThrow({
    where: {
      id: params.fileId,
      parentId: params.folderId,
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          folder: {
            select: {
              id: true,
              childCount: true,
            },
          },
        },
      },
      favorites: {
        select: {
          favoritedBy: {
            select: {
              image: true,
              name: true,
              id: true,
            },
          },
        },
      },
      permissions: {
        select: {
          _count: { select: { users: true } },
          roles: true,
          users: {
            select: {
              id: true,
              image: true,
              name: true,
            },
          },
        },
      },
      locked: {
        select: {
          id: true,
          expiresAt: true,
          lockedAt: true,
          lockedById: true,
          lockedBy: {
            select: {
              image: true,
              name: true,
              id: true,
            },
          },
        },
      },
      file: {
        select: {
          id: true,
          mimeType: true,
          extension: true,
          key: true,
        },
      },
      thumbnails: {
        where: {
          size: {
            equals: 'custom',
          },
        },
        select: {
          url: true,
          width: true,
          height: true,
        },
      },
    },
  })

  return { item, crumbs }
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

// export const handle = {
//   breadcrumb: ({
//     params,
//     pathname,
//     id,
//     loaderData,
//   }: UIMatch<Awaited<ReturnType<typeof loader>>>) => {
//     console.log("Generating breadcrumb for folder route", {
//       params,
//       pathname,
//       id,
//       loaderData,
//     });
//     let to = href("/dashboard/folders/:folderId/files/:fileId", {
//       folderId: params.folderId!,
//       fileId: params.fileId!,
//     });

//     let links = fullPath.map((segment, index) => {
//       return (
//         <>
//         <BreadcrumbItem key={index}>
//         <BreadcrumbLink asChild>
//           <Link
//             to={href("/dashboard/folders/:folderId", {
//               folderId: params.folderId!,
//             })}
//             >{segment}</Link>
//         </BreadcrumbLink>
//         </BreadcrumbItem>
//         <BreadcrumbSeparator />
//             </>
//       );
//     });
//     links.push(
//       <BreadcrumbItem key="current">
//         <BreadcrumbPage>{loaderData?.item.name}</BreadcrumbPage>
//       </BreadcrumbItem>
//     );
//     return links
//   },
// };

export default ({ loaderData }: Route.ComponentProps) => {
  let { item, crumbs } = loaderData

  return (
    <div>
      <pre>
        <code className="font-stashly">
          {JSON.stringify(
            crumbs,
            (key, value) => {
              return key === 'size' || key === "inclusiveSize" ? Number(value) : value
            },
            2
          )}
        </code>
      </pre>
      <pre>
        <code className="font-stashly">
          {JSON.stringify(
            item,
            (key, value) => {
              return key === 'size' || key === "inclusiveSize" ? Number(value) : value
            },
            2
          )}
        </code>
      </pre>
    </div>
  )
}
