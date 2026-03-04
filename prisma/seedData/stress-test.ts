import '@dotenvx/dotenvx/config'
import { faker } from '@faker-js/faker'
import { inspect } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  PrismaClient,
  type Item,
  type User,
  type Drive,
} from '../../app/prisma/client'
import {
  generateMockItemWithFile,
  generateMockItemWithFolder,
  generateMockDrive,
  generateMockStoragePlans,
  generateMockUsers,
} from './data'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not defined in environment variables. Make sure your .env file is loaded.'
  )
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({
  adapter,
})

// Configuration for the stress test
const CONFIG = {
  MAX_DEPTH: 5, // How deep the nesting goes (node_modules inside node_modules)
  MAX_PACKAGES_PER_LEVEL: 3, // Max number of packages inside a single node_modules
  FILES_PER_PACKAGE: 4, // Standard files per package (package.json, index.js, etc)
}

/**
 * Creates a simulated file with a specific name inside a parent folder.
 */
async function createSpecificFile(
  name: string,
  parent: Item,
  user: User,
  drive: Drive
) {
  const fileData = generateMockItemWithFile(user, drive, parent)

  // Override random generation with specific node_module like names
  fileData.name = name

  // Quick fix for extensions based on name to make it look realistic
  if (name.endsWith('.json')) {
    fileData.file!.create!.mimeType = 'application/json'
  } else if (name.endsWith('.js')) {
    fileData.file!.create!.mimeType = 'application/javascript'
  } else if (name.endsWith('.md')) {
    fileData.file!.create!.mimeType = 'text/markdown'
  }

  return await prisma.item.create({
    data: fileData,
  })
}

/**
 * Recursive function to generate a package, its files, and its dependencies.
 */
async function generatePackage(
  packageName: string,
  parentId: string,
  user: User,
  drive: Drive,
  currentDepth: number
) {
  // 1. Create the package folder (e.g., "react", "lodash")
  const packageFolderData = generateMockItemWithFolder({
    user,
    drive,
    name: packageName,
    parent: { id: parentId } as Item,
  })

  const packageFolder = await prisma.item.create({
    data: packageFolderData,
  })

  // 2. Create standard package files inside
  const standardFiles = ['package.json', 'index.js', 'README.md', 'LICENSE']
  await Promise.all(
    standardFiles.map((fname) =>
      createSpecificFile(fname, packageFolder, user, drive)
    )
  )

  // 3. Create 'src' folder with some dummy code files (adds breadth)
  const srcFolderData = generateMockItemWithFolder({
    user,
    drive,
    name: 'src',
    parent: packageFolder,
  })
  const srcFolder = await prisma.item.create({ data: srcFolderData })

  await Promise.all(
    ['utils.js', 'main.js', 'types.d.ts'].map((f) =>
      createSpecificFile(f, srcFolder, user, drive)
    )
  )

  // 4. Recursion: Create 'node_modules' with dependencies if depth allows
  if (currentDepth < CONFIG.MAX_DEPTH) {
    const nodeModulesData = generateMockItemWithFolder({
      user,
      drive,
      name: 'node_modules',
      parent: packageFolder,
    })
    const nodeModulesFolder = await prisma.item.create({
      data: nodeModulesData,
    })

    // Determine how many dependencies this package has
    const dependencyCount = faker.number.int({
      min: 1,
      max: CONFIG.MAX_PACKAGES_PER_LEVEL,
    })

    // Generate dependencies sequentially to manage DB load, or Promise.all for speed
    const dependencies = faker.helpers.uniqueArray(
      faker.word.noun,
      dependencyCount
    )

    for (const depName of dependencies) {
      // Recurse with incremented depth
      await generatePackage(
        depName,
        nodeModulesFolder.id,
        user,
        drive,
        currentDepth + 1
      )
    }
  }
}

async function main(): Promise<void> {
  try {
    console.log('Starting Node_Modules Stress Test Seeding...')

    // Optional: Clean up only if you want a fresh start, commented out for safety
    // await prisma.item.deleteMany()
    // await prisma.drive.deleteMany()
    // await prisma.user.deleteMany()

    // 1. Setup User and Drive
    console.log('Creating User and Storage Plans...')
    const createdStoragePlans = await prisma.storagePlan.createManyAndReturn({
      data: generateMockStoragePlans(),
      skipDuplicates: true, // In case plans already exist
    })

    // Fallback if skipDuplicates caused empty return
    const plan =
      createdStoragePlans[1] ||
      (await prisma.storagePlan.findFirst({ where: { tag: 'basic' } }))

    if (!plan) throw new Error('Storage Plan creation failed')

    const user = await prisma.user.create({
      data: generateMockUsers(1)[0],
    })

    const drive = await prisma.drive.create({
      data: generateMockDrive(user, plan),
      include: { quota: true },
    })

    console.log(`User created: ${user.id}`)
    console.log(`Drive created: ${drive.id}`)

    // 2. Create Root "Project" Folder
    const rootFolderData = generateMockItemWithFolder({
      user,
      drive,
      name: 'root',
      // No parent means root
      parent: { id: drive.id } as Item,
    })
    const rootProjectData = generateMockItemWithFolder({
      user,
      drive,
      name: 'stress-test-project',
      // No parent means root
      parent: { id: rootFolderData.id } as Item,
    })

    // Manually setting parentId to null for root if needed, though helper handles undefined
    // if (!rootProjectData.parentId) rootProjectData.parentId = null

    const rootFolder = await prisma.item.create({
      data: rootFolderData,
    })

    const rootProject = await prisma.item.create({
      data: rootProjectData,
    })

    // 3. Create top-level node_modules
    console.log('Generating recursive node_modules structure...')
    const rootNodeModulesData = generateMockItemWithFolder({
      user,
      drive,
      name: 'node_modules',
      parent: rootProject,
    })
    const rootNodeModules = await prisma.item.create({
      data: rootNodeModulesData,
    })

    // 4. Start Recursion
    // Start with a few popular "frameworks"
    const topLevelPackages = [
      'react',
      'express',
      'typescript',
      'lodash',
      'commander',
    ]

    for (const pkg of topLevelPackages) {
      console.log(`Generating package tree for: ${pkg}`)
      await generatePackage(pkg, rootNodeModules.id, user, drive, 1)
    }

    console.log('Seeding Complete!')
    console.log(
      inspect(
        `Root folder: (${rootFolder.id}) project folder: stress-test-project (${rootProject.id})`,
        { depth: null, colors: true }
      )
    )
  } catch (error) {
    console.error('Error seeding database:', error)
  }
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
