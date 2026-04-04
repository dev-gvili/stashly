import { cn } from '@/utils/styles'
import type { SVGProps } from 'react'

const GalleryWide = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentcolor"
      strokeWidth={1.5}
      d="M2 13.438C2 9.665 2 7.78 3.172 6.609 4.343 5.438 6.229 5.438 10 5.438h4c3.771 0 5.657 0 6.828 1.171C22 7.781 22 9.666 22 13.438c0 3.77 0 5.656-1.172 6.828-1.171 1.172-3.057 1.172-6.828 1.172h-4c-3.771 0-5.657 0-6.828-1.172C2 19.094 2 17.209 2 13.438Z"
    />
    <path
      stroke="currentcolor"
      strokeWidth={1.5}
      d="M3.988 6c.112-.931.347-1.574.837-2.063C5.765 3 7.279 3 10.307 3h3.211c3.028 0 4.541 0 5.482.937.49.489.725 1.132.837 2.063"
      opacity={0.5}
    />
    <circle
      cx={17.5}
      cy={9.938}
      r={1.5}
      stroke="currentcolor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentcolor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m2 13.938 1.752-1.533a2.3 2.3 0 0 1 3.14.105l4.29 4.29a2 2 0 0 0 2.564.221l.299-.21a3 3 0 0 1 3.731.226l3.224 2.9"
      opacity={0.5}
    />
  </svg>
)
export { GalleryWide }

const PdfIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704zm-1.42 1.03c-.107.532-.64.887-1.384.887-.213 0-.39-.036-.604-.071-1.348-.32-2.626-.994-3.903-2.059a17.717 17.717 0 0 1 2.98-.248c.746 0 1.385.035 1.81.142.497.106 1.278.426 1.1 1.348zm-7.524-1.668a38.01 38.01 0 0 0-2.945.674 39.68 39.68 0 0 0-2.52.745 40.05 40.05 0 0 0 1.207-2.555c.426-.994.78-2.023 1.136-2.981.354.603.745 1.207 1.135 1.739a50.127 50.127 0 0 0 1.987 2.378zM10.038 1.46a.768.768 0 0 1 .674-.425c.745 0 .887.851.887 1.526 0 1.135-.355 2.874-.958 4.861-1.03-2.768-1.1-5.074-.603-5.962zM6.134 17.997c-1.81 2.981-3.549 4.826-4.613 4.826a.872.872 0 0 1-.532-.177c-.213-.213-.32-.461-.249-.745.213-1.065 2.271-2.555 5.394-3.904Z"
    />
  </svg>
)
export { PdfIcon }

const SoundWave = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 4v16"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M16 7v10M8 7v10"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20 11v2M4 11v2"
    />
  </svg>
)
export { SoundWave }

const FileIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      opacity={0.5}
      // strokeWidth={1.5}
      d="m15.393 4.054-.502.557.502-.557Zm3.959 3.563-.502.557.502-.557Zm2.302 2.537-.685.305.685-.305ZM3.172 20.828l.53-.53-.53.53Zm17.656 0-.53-.53.53.53ZM14 21.25h-4v1.5h4v-1.5ZM2.75 14v-4h-1.5v4h1.5Zm18.5-.437V14h1.5v-.437h-1.5ZM14.891 4.61l3.959 3.563 1.003-1.115-3.958-3.563-1.004 1.115Zm7.859 8.952c0-1.689.015-2.758-.41-3.714l-1.371.61c.266.598.281 1.283.281 3.104h1.5Zm-3.9-5.389c1.353 1.218 1.853 1.688 2.119 2.285l1.37-.61c-.426-.957-1.23-1.66-2.486-2.79L18.85 8.174ZM10.03 2.75c1.582 0 2.179.012 2.71.216l.538-1.4c-.852-.328-1.78-.316-3.248-.316v1.5Zm5.865.746c-1.086-.977-1.765-1.604-2.617-1.93l-.537 1.4c.532.204.98.592 2.15 1.645l1.004-1.115ZM10 21.25c-1.907 0-3.261-.002-4.29-.14-1.005-.135-1.585-.389-2.008-.812l-1.06 1.06c.748.75 1.697 1.081 2.869 1.239 1.15.155 2.625.153 4.489.153v-1.5ZM1.25 14c0 1.864-.002 3.338.153 4.489.158 1.172.49 2.121 1.238 2.87l1.06-1.06c-.422-.424-.676-1.004-.811-2.01-.138-1.027-.14-2.382-.14-4.289h-1.5ZM14 22.75c1.864 0 3.338.002 4.489-.153 1.172-.158 2.121-.49 2.87-1.238l-1.06-1.06c-.424.422-1.004.676-2.01.811-1.027.138-2.382.14-4.289.14v1.5ZM21.25 14c0 1.907-.002 3.262-.14 4.29-.135 1.005-.389 1.585-.812 2.008l1.06 1.06c.75-.748 1.081-1.697 1.239-2.869.155-1.15.153-2.625.153-4.489h-1.5Zm-18.5-4c0-1.907.002-3.261.14-4.29.135-1.005.389-1.585.812-2.008l-1.06-1.06c-.75.748-1.081 1.697-1.239 2.869C1.248 6.661 1.25 8.136 1.25 10h1.5Zm7.28-8.75c-1.875 0-3.356-.002-4.511.153-1.177.158-2.129.49-2.878 1.238l1.06 1.06c.424-.422 1.005-.676 2.017-.811 1.033-.138 2.395-.14 4.312-.14v-1.5Z"
    />
    <path
      fill="currentColor"
      // stroke="currentColor"
      // strokeWidth={1.5}
      d="M13 2.5V5c0 2.357 0 3.536.732 4.268C14.464 10 15.643 10 18 10h4"
      // opacity={0.5}
    />
  </svg>
)
export { FileIcon }

const ImageIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      // stroke="currentColor"
      className="stroke-current"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <circle
      cx={16}
      cy={8}
      r={2}
      className="stroke-current"
      // stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      className="stroke-current"
      // stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m5 13.307.81-.753a2.3 2.3 0 0 1 3.24.108l2.647 2.81c.539.572 1.42.649 2.049.18a2.317 2.317 0 0 1 2.986.181L19 18"
      opacity={0.5}
    />
  </svg>
)

export { ImageIcon }

const VideoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M21.5 8h-19M7 8l3.5-5.5m3 5.5L17 2.5M15 14.5c0-.633-.662-1.06-1.986-1.915-1.342-.866-2.013-1.299-2.514-.98-.5.317-.5 1.176-.5 2.895s0 2.578.5 2.896c.5.318 1.172-.115 2.514-.981C14.338 15.56 15 15.133 15 14.5Z"
      opacity={0.5}
    />
  </svg>
)
export { VideoIcon }

const FolderIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      className="stroke-current"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M18 10h-5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      className="stroke-current"
      strokeWidth={1.5}
      d="M10 3h6.5c.464 0 .697 0 .892.026a3 3 0 0 1 2.582 2.582c.026.195.026.428.026.892"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      className="stroke-current"
      strokeWidth={1.5}
      d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.119.28.255.554.529L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c2.632 0 3.949 0 4.804.77.079.07.154.145.224.224.77.855.77 2.172.77 4.804V14c0 3.771 0 5.657-1.172 6.828C19.657 22 17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172C2 19.657 2 17.771 2 14V6.95Z"
    />
  </svg>
)
export { FolderIcon }

const ArchiveIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3 10c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h2c3.771 0 5.657 0 6.828 1.172S21 6.229 21 10v4c0 3.771 0 5.657-1.172 6.828S16.771 22 13 22h-2c-3.771 0-5.657 0-6.828-1.172S3 17.771 3 14z"
    />
    <path
      stroke="currentColor"
      opacity={0.5}
      strokeWidth={1.5}
      d="M9.5 3c0-.471 0-.707.146-.854C9.793 2 10.03 2 10.5 2h.5c.471 0 .707 0 .854.146C12 2.293 12 2.53 12 3v.5c0 .471 0 .707-.146.854-.147.146-.383.146-.854.146h-.5c-.471 0-.707 0-.854-.146C9.5 4.207 9.5 3.97 9.5 3.5zM9.5 8c0-.471 0-.707.146-.854C9.793 7 10.03 7 10.5 7h.5c.471 0 .707 0 .854.146C12 7.293 12 7.53 12 8v.5c0 .471 0 .707-.146.854-.147.146-.383.146-.854.146h-.5c-.471 0-.707 0-.854-.146C9.5 9.207 9.5 8.97 9.5 8.5zM12 5.5c0-.471 0-.707.146-.854.147-.146.383-.146.854-.146h.5c.471 0 .707 0 .854.146.146.147.146.383.146.854V6c0 .471 0 .707-.146.854C14.207 7 13.97 7 13.5 7H13c-.471 0-.707 0-.854-.146C12 6.707 12 6.47 12 6zM12 10.5c0-.471 0-.707.146-.854.147-.146.383-.146.854-.146h.5c.471 0 .707 0 .854.146.146.147.146.383.146.854v.5c0 .471 0 .707-.146.854-.147.146-.383.146-.854.146H13c-.471 0-.707 0-.854-.146C12 11.707 12 11.47 12 11z"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9.5 15.5v-.125c0-.483.392-.875.875-.875h3.25c.483 0 .875.392.875.875v.125a2.5 2.5 0 0 1-5 0Z"
    />
  </svg>
)
export { ArchiveIcon }

const BinaryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 19h8M8 5h8M19 16V8M5 16V8"
      opacity={0.5}
    />
  </svg>
)
export { BinaryIcon }

const SlidesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M6 8c0-2.828 0-4.243.879-5.121C7.757 2 9.172 2 12 2c2.828 0 4.243 0 5.121.879C18 3.757 18 5.172 18 8v8c0 2.828 0 4.243-.879 5.121C16.243 22 14.828 22 12 22c-2.828 0-4.243 0-5.121-.879C6 20.243 6 18.828 6 16V8Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M18 19.5c1.4 0 2.1 0 2.635-.273a2.5 2.5 0 0 0 1.092-1.092C22 17.6 22 16.9 22 15.5v-7c0-1.4 0-2.1-.273-2.635a2.5 2.5 0 0 0-1.092-1.093C20.1 4.5 19.4 4.5 18 4.5M6 19.5c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C2 17.6 2 16.9 2 15.5v-7c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.093C3.9 4.5 4.6 4.5 6 4.5"
      opacity={0.5}
    />
  </svg>
)
export { SlidesIcon }

const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3.033 8.89c-.48-3.204-.72-4.805.177-5.848C4.108 2 5.728 2 8.967 2h6.066c3.24 0 4.859 0 5.757 1.042.897 1.043.657 2.644.176 5.848l-1.2 8c-.365 2.438-.548 3.656-1.392 4.383-.844.727-2.076.727-4.541.727h-3.666c-2.465 0-3.697 0-4.541-.727-.844-.727-1.027-1.945-1.393-4.383l-1.2-8Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M21 6H3"
    />
    <path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m8 6-4.5 5 7.5 8m3-13L4 16M20 6 7 19m6 0 7.5-8L16 6m-6 0 10 10M4 6l13 13"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M19 19H5"
    />
  </svg>
)
export { TrashIcon }

const WorkspaceIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M19.562 7a2.132 2.132 0 0 0-2.1-2.5H6.538a2.132 2.132 0 0 0-2.1 2.5M17.5 4.5c.028-.26.043-.389.043-.496a2 2 0 0 0-1.787-1.993C15.65 2 15.52 2 15.26 2H8.74c-.26 0-.391 0-.497.011a2 2 0 0 0-1.787 1.993c0 .107.014.237.043.496"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 18H9"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2.384 13.793c-.447-3.164-.67-4.745.278-5.77C3.61 7 5.298 7 8.672 7h6.656c3.374 0 5.062 0 6.01 1.024.947 1.024.724 2.605.278 5.769l-.422 3c-.35 2.48-.525 3.721-1.422 4.464-.897.743-2.22.743-4.867.743h-5.81c-2.646 0-3.97 0-4.867-.743-.897-.743-1.072-1.983-1.422-4.464l-.422-3Z"
    />
  </svg>
)
export { WorkspaceIcon }

const CollectionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M5 8c0-2.828 0-4.243.879-5.121C6.757 2 8.172 2 11 2h2c2.828 0 4.243 0 5.121.879C19 3.757 19 5.172 19 8v8c0 2.828 0 4.243-.879 5.121C17.243 22 15.828 22 13 22h-2c-2.828 0-4.243 0-5.121-.879C5 20.243 5 18.828 5 16V8Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M5 4.076c-.975.096-1.631.313-2.121.803C2 5.757 2 7.172 2 10v4c0 2.828 0 4.243.879 5.121.49.49 1.146.707 2.121.803M19 4.076c.975.096 1.631.313 2.121.803C22 5.757 22 7.172 22 10v4c0 2.828 0 4.243-.879 5.121-.49.49-1.146.707-2.121.803"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9 13h6"
      opacity={0.7}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9 9h6"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9 17h3"
      opacity={0.4}
    />
  </svg>
)
export { CollectionIcon }

const RecentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 8v4l2.5 2.5"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
  </svg>
)
export { RecentIcon }

const HashTagIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      // fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={1}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.5}
      strokeWidth={1.5}
      d="M11 7 8 17M16 7l-3 10M18 10H7M17 14H6"
    />
  </svg>
)
export { HashTagIcon }

const DocumentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3 10c0-3.771 0-5.657 1.172-6.828C5.343 2 7.229 2 11 2h2c3.771 0 5.657 0 6.828 1.172C21 4.343 21 6.229 21 10v4c0 3.771 0 5.657-1.172 6.828C18.657 22 16.771 22 13 22h-2c-3.771 0-5.657 0-6.828-1.172C3 19.657 3 17.771 3 14v-4Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 12h8M8 8h8M8 16h5"
    />
  </svg>
)
export { DocumentIcon }

const Pdf2Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeWidth={0.5}
      fill="currentColor"
      d="M17.815 13.65c-.355-.372-1.083-.585-2.112-.585-.55 0-1.189.053-1.88.177a9.722 9.722 0 0 1-1.154-1.33 10.76 10.76 0 0 1-.71-1.119c.408-1.241.604-2.253.604-2.98 0-.816-.302-1.668-1.172-1.668a.823.823 0 0 0-.674.39c-.39.692-.212 2.2.462 3.69a30.139 30.139 0 0 1-.852 2.254 20.7 20.7 0 0 1-.959 2.005c-1.951.781-3.211 1.686-3.353 2.395a.767.767 0 0 0 .231.71c.071.053.32.267.745.267 1.295 0 2.662-2.095 3.353-3.354.533-.178 1.066-.355 1.598-.497a17.482 17.482 0 0 1 1.703-.373c1.366 1.224 2.572 1.42 3.176 1.42.745 0 1.011-.302 1.1-.55a.792.792 0 0 0-.106-.852zm-.71.515c-.054.266-.32.444-.692.444-.107 0-.195-.018-.302-.036-.674-.16-1.313-.497-1.952-1.03a8.858 8.858 0 0 1 1.49-.123c.373 0 .693.017.905.07.249.053.64.213.55.674zm-3.762-.834a19.005 19.005 0 0 0-1.473.337 19.84 19.84 0 0 0-1.26.373 20.025 20.025 0 0 0 .604-1.278c.213-.497.39-1.011.568-1.49.177.301.372.603.567.869a25.064 25.064 0 0 0 .994 1.189zM11.019 6.73a.384.384 0 0 1 .337-.212c.372 0 .444.425.444.763 0 .567-.178 1.437-.48 2.43-.514-1.384-.55-2.537-.301-2.981zm-1.952 8.268c-.905 1.491-1.774 2.414-2.307 2.414a.436.436 0 0 1-.265-.089c-.107-.106-.16-.23-.125-.372.106-.533 1.135-1.278 2.697-1.952z"
    />
  </svg>
)
export { Pdf2Icon }

const Audio2Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      // fill="none"
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      opacity={0.5}
      d="M12 7v10M17 10v4M7 9v6"
    />
  </svg>
)
export { Audio2Icon }

const ShareIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M12 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM5.5 21a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM18.5 21a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20 13a7.98 7.98 0 0 0-2.708-6M4 13a7.98 7.98 0 0 1 2.708-6M10 20.748c.64.165 1.31.252 2 .252s1.36-.087 2-.252"
      opacity={0.5}
    />
  </svg>
)
export { ShareIcon }

const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M7.843 3.802C9.872 2.601 10.886 2 12 2c1.114 0 2.128.6 4.157 1.802l.686.406c2.029 1.202 3.043 1.803 3.6 2.792.557.99.557 2.19.557 4.594v.812c0 2.403 0 3.605-.557 4.594-.557.99-1.571 1.59-3.6 2.791l-.686.407C14.128 21.399 13.114 22 12 22c-1.114 0-2.128-.6-4.157-1.802l-.686-.407c-2.029-1.2-3.043-1.802-3.6-2.791C3 16.01 3 14.81 3 12.406v-.812C3 9.19 3 7.989 3.557 7c.557-.99 1.571-1.59 3.6-2.792l.686-.406Z"
      opacity={0.5}
    />
    <circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.5} />
  </svg>
)
export { SettingsIcon }

const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8.002 7c.012-2.175.108-3.353.877-4.121C9.757 2 11.172 2 14 2h1c2.828 0 4.243 0 5.121.879C21 3.757 21 5.172 21 8v8c0 2.828 0 4.243-.879 5.121C19.243 22 17.828 22 15 22h-1c-2.829 0-4.243 0-5.121-.879-.769-.768-.865-1.946-.877-4.121"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M8 19.5c-2.357 0-3.536 0-4.268-.732C3 18.035 3 16.857 3 14.5v-5c0-2.357 0-3.536.732-4.268C4.464 4.5 5.643 4.5 8 4.5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 12H6m0 0 2 2m-2-2 2-2"
    />
  </svg>
)
export { LogoutIcon }

const UserIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx={12} cy={6} r={4} stroke="currentColor" strokeWidth={1.5} />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z"
      opacity={0.5}
    />
  </svg>
)
export { UserIcon }

const LockedIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17.26 11.44c2.618 0 4.74-2.113 4.74-4.72C22 4.113 19.878 2 17.26 2c-2.617 0-4.739 2.113-4.739 4.72 0 1.208.551 2.086.551 2.086l-5.731 5.708c-.257.256-.617.922 0 1.537l.661.658c.257.22.904.527 1.433 0l.771-.768c.772.768 1.654.329 1.984-.11.552-.768-.11-1.537-.11-1.537l.22-.22c1.059 1.054 1.985.44 2.315 0 .551-.768 0-1.536 0-1.536-.22-.44-.661-.44-.11-.988l.661-.659c.53.44 1.617.55 2.095.55Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M17.26 8.366a1.65 1.65 0 0 0 1.654-1.646c0-.91-.74-1.647-1.654-1.647a1.65 1.65 0 0 0-1.653 1.647c0 .91.74 1.646 1.654 1.646Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M22 14.993c-.064 2.794-.33 4.426-1.446 5.541C19.088 22 16.73 22 12.01 22s-7.078 0-8.544-1.466C2 19.068 2 16.71 2 11.99s0-7.078 1.466-8.544C4.58 2.33 6.213 2.064 9.007 2"
      opacity={0.5}
    />
  </svg>
)
export { LockedIcon }

const CodeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill=""
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      opacity={0.5}
      d="m15.5 9 .172.172c1.333 1.333 2 2 2 2.828 0 .828-.667 1.495-2 2.828L15.5 15M13.294 7.17 12 12l-1.294 4.83M8.5 9l-.172.172c-1.333 1.333-2 2-2 2.828 0 .828.667 1.495 2 2.828L8.5 15"
    />
  </svg>
)
export { CodeIcon }

const ShellIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      opacity={0.5}
      d="M17 15h-5M7 10l.234.195c1.282 1.068 1.923 1.602 1.923 2.305 0 .703-.64 1.237-1.923 2.305L7 15"
    />
  </svg>
)
export { ShellIcon }

const FavoriteIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="m8.962 19.338.477-.578-.477.578ZM12 5.317l-.552.508a.75.75 0 0 0 1.104 0L12 5.317ZM9.439 18.76C6.385 16.242 2.75 13.773 2.75 9.119h-1.5c0 5.516 4.404 8.465 7.235 10.798l.954-1.157ZM2.75 9.119c0-2.28 1.232-4.174 2.886-4.964 1.596-.763 3.75-.57 5.812 1.67l1.104-1.016C10.114 2.16 7.268 1.712 4.989 2.8 2.768 3.863 1.25 6.314 1.25 9.12h1.5Zm5.735 10.798c.512.422 1.062.872 1.62 1.213.556.34 1.196.62 1.895.62v-1.5c-.301 0-.66-.123-1.114-.4-.452-.276-.921-.657-1.447-1.09l-.954 1.157ZM22.75 9.12c0-2.805-1.518-5.256-3.74-6.318-2.278-1.089-5.124-.64-7.562 2.008l1.104 1.016c2.062-2.24 4.216-2.433 5.812-1.67 1.654.79 2.886 2.684 2.886 4.964h1.5Zm-.926 4.122a9.41 9.41 0 0 0 .926-4.122h-1.5a7.91 7.91 0 0 1-.78 3.475l1.354.647Zm-7.885 6.023c-.827.648-1.433.986-1.939.986v1.5c1.083 0 2.065-.679 2.865-1.306l-.926-1.18Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="m14.829 20.17.45-.601-.45.6Zm1.671-7.012-.527.534a.75.75 0 0 0 1.054 0l-.527-.534Zm1.671 7.011-.45-.6.45.6Zm2.976-7.251.543-.518-.543.518Zm-6.745 6.936-.443.605.443-.605ZM11.75 15.06c0-.97.576-1.788 1.37-2.133.757-.329 1.81-.264 2.853.765l1.054-1.067c-1.433-1.415-3.13-1.671-4.504-1.074a3.817 3.817 0 0 0-2.273 3.508h1.5Zm2.63 5.71c.278.208.598.448.928.63.33.184.736.35 1.192.35v-1.5c-.094 0-.238-.036-.463-.16a7.087 7.087 0 0 1-.758-.521l-.9 1.2Zm4.24 0c.765-.573 1.806-1.273 2.62-2.145.84-.899 1.51-2.047 1.51-3.566h-1.5c0 1.025-.436 1.825-1.106 2.542-.695.745-1.568 1.328-2.423 1.968l.9 1.2Zm-.899-1.201a7.087 7.087 0 0 1-.758.52c-.225.125-.369.161-.463.161v1.5c.456 0 .861-.166 1.192-.35.33-.182.65-.422.929-.63l-.9-1.201Zm5.029-4.51a3.843 3.843 0 0 0-1.06-2.66l-1.085 1.037c.397.415.645.987.645 1.623h1.5Zm-1.06-2.66a3.676 3.676 0 0 0-2.643-1.149c-1.044-.005-2.121.434-3.074 1.375l1.054 1.067c.71-.7 1.418-.945 2.013-.942.603.003 1.159.26 1.565.685L21.69 12.4Zm-6.411 7.17a48.899 48.899 0 0 0-.434-.32l-.886 1.21.42.31.9-1.2Zm-.434-.32c-1.626-1.191-3.095-2.307-3.095-4.19h-1.5c0 2.767 2.227 4.315 3.709 5.4l.886-1.21Z"
    />
  </svg>
)
export { FavoriteIcon }

const FilterIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      className="stroke-foreground"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 22h6c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7Z"
      opacity={0.5}
    />
    <path
      className="stroke-foreground"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M8.16 6.65h7.67c.64 0 1.16.52 1.16 1.16v1.28c0 .47-.29 1.05-.58 1.34l-2.5 2.21c-.35.29-.58.87-.58 1.34v2.5c0 .35-.23.81-.52.99l-.81.51c-.76.47-1.8-.06-1.8-.99v-3.08c0-.41-.23-.93-.47-1.22l-2.21-2.33C7.23 10.08 7 9.55 7 9.2V7.87c0-.7.52-1.22 1.16-1.22Z"
    />
  </svg>
)
export { FilterIcon }

const AddIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 12h-3m0 0H9m3 0V9m0 3v3"
    />
  </svg>
)
export { AddIcon }

const SidebarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 11c0-3.771 0-5.657 1.172-6.828C4.343 3 6.229 3 10 3h4c3.771 0 5.657 0 6.828 1.172C22 5.343 22 7.229 22 11v2c0 3.771 0 5.657-1.172 6.828C19.657 21 17.771 21 14 21h-4c-3.771 0-5.657 0-6.828-1.172C2 18.657 2 16.771 2 13v-2Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 21V3"
      opacity={0.5}
    />
  </svg>
)
export { SidebarIcon }

const RiverIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    className={cn('rotate-90', className)}
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M22 10.9V4.1c0-1.5-.64-2.1-2.23-2.1h-4.04c-1.59 0-2.23.6-2.23 2.1v6.8c0 1.5.64 2.1 2.23 2.1h4.04c1.59 0 2.23-.6 2.23-2.1Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M22 19.9v-1.8c0-1.5-.64-2.1-2.23-2.1h-4.04c-1.59 0-2.23.6-2.23 2.1v1.8c0 1.5.64 2.1 2.23 2.1h4.04c1.59 0 2.23-.6 2.23-2.1Z"
      opacity={0.4}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.5 13.1v6.8c0 1.5-.64 2.1-2.23 2.1H4.23C2.64 22 2 21.4 2 19.9v-6.8c0-1.5.64-2.1 2.23-2.1h4.04c1.59 0 2.23.6 2.23 2.1Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.5 4.1v1.8c0 1.5-.64 2.1-2.23 2.1H4.23C2.64 8 2 7.4 2 5.9V4.1C2 2.6 2.64 2 4.23 2h4.04c1.59 0 2.23.6 2.23 2.1Z"
      opacity={0.4}
    />
  </svg>
)
export { RiverIcon }

const WaterfallIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2.5 6.5c0-1.886 0-2.828.586-3.414S4.614 2.5 6.5 2.5s2.828 0 3.414.586.586 1.528.586 3.414v11c0 1.886 0 2.828-.586 3.414S8.386 21.5 6.5 21.5s-2.828 0-3.414-.586S2.5 19.386 2.5 17.5z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M13.5 15.5c0-1.886 0-2.828.586-3.414s1.528-.586 3.414-.586 2.828 0 3.414.586.586 1.528.586 3.414v2c0 1.886 0 2.828-.586 3.414s-1.528.586-3.414.586-2.828 0-3.414-.586-.586-1.528-.586-3.414zM13.5 5.5c0-.932 0-1.398.152-1.765a2 2 0 0 1 1.083-1.083c.367-.152.833-.152 1.765-.152h2c.932 0 1.398 0 1.765.152a2 2 0 0 1 1.083 1.083c.152.367.152.833.152 1.765s0 1.398-.152 1.765a2 2 0 0 1-1.083 1.083c-.367.152-.833.152-1.765.152h-2c-.932 0-1.398 0-1.765-.152a2 2 0 0 1-1.083-1.083C13.5 6.898 13.5 6.432 13.5 5.5Z"
    />
  </svg>
)
export { WaterfallIcon }
// const WaterfallIcon = (props: SVGProps<SVGSVGElement>) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width="1em"
//     height="1em"
//     fill="none"
//     viewBox="0 0 24 24"
//     {...props}
//   >
//     <path
//       stroke="currentColor"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//       strokeWidth={1.5}
//       d="M10.5 19.9V4.1c0-1.5-.64-2.1-2.23-2.1H4.23C2.64 2 2 2.6 2 4.1v15.8c0 1.5.64 2.1 2.23 2.1h4.04c1.59 0 2.23-.6 2.23-2.1ZM22 10.9V4.1c0-1.5-.64-2.1-2.23-2.1h-4.04c-1.59 0-2.23.6-2.23 2.1v6.8c0 1.5.64 2.1 2.23 2.1h4.04c1.59 0 2.23-.6 2.23-2.1Z"
//     />
//     <path
//       stroke="currentColor"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//       strokeWidth={1.5}
//       d="M22 19.9v-1.8c0-1.5-.64-2.1-2.23-2.1h-4.04c-1.59 0-2.23.6-2.23 2.1v1.8c0 1.5.64 2.1 2.23 2.1h4.04c1.59 0 2.23-.6 2.23-2.1Z"
//       opacity={0.4}
//     />
//   </svg>
// )
// export { WaterfallIcon }

const GridIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M22 8.52V3.98C22 2.57 21.36 2 19.77 2h-4.04c-1.59 0-2.23.57-2.23 1.98v4.53c0 1.42.64 1.98 2.23 1.98h4.04c1.59.01 2.23-.56 2.23-1.97Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M22 19.77v-4.04c0-1.59-.64-2.23-2.23-2.23h-4.04c-1.59 0-2.23.64-2.23 2.23v4.04c0 1.59.64 2.23 2.23 2.23h4.04c1.59 0 2.23-.64 2.23-2.23ZM10.5 8.52V3.98C10.5 2.57 9.86 2 8.27 2H4.23C2.64 2 2 2.57 2 3.98v4.53c0 1.42.64 1.98 2.23 1.98h4.04c1.59.01 2.23-.56 2.23-1.97Z"
      opacity={0.4}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.5 19.77v-4.04c0-1.59-.64-2.23-2.23-2.23H4.23c-1.59 0-2.23.64-2.23 2.23v4.04C2 21.36 2.64 22 4.23 22h4.04c1.59 0 2.23-.64 2.23-2.23Z"
    />
  </svg>
)
export { GridIcon }

const SunIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx={12} cy={12} r={5} stroke="currentColor" strokeWidth={1.5} />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 2v2M12 20v2M4 12H2M22 12h-2"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m19.778 4.223-2.222 2.031M4.222 4.223l2.222 2.031M6.444 17.556l-2.222 2.222M19.778 19.777l-2.222-2.222"
      opacity={0.5}
    />
  </svg>
)
export { SunIcon }

const MoonIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="m21.067 11.857-.642-.388zm-8.924-8.924-.388-.642zM21.25 12A9.25 9.25 0 0 1 12 21.25v1.5c5.937 0 10.75-4.813 10.75-10.75zM12 21.25A9.25 9.25 0 0 1 2.75 12h-1.5c0 5.937 4.813 10.75 10.75 10.75zM2.75 12A9.25 9.25 0 0 1 12 2.75v-1.5C6.063 1.25 1.25 6.063 1.25 12zm12.75 2.25A5.75 5.75 0 0 1 9.75 8.5h-1.5a7.25 7.25 0 0 0 7.25 7.25zm4.925-2.781A5.75 5.75 0 0 1 15.5 14.25v1.5a7.25 7.25 0 0 0 6.21-3.505zM9.75 8.5a5.75 5.75 0 0 1 2.781-4.925l-.776-1.284A7.25 7.25 0 0 0 8.25 8.5zM12 2.75a.38.38 0 0 1-.268-.118.3.3 0 0 1-.082-.155c-.004-.031-.002-.121.105-.186l.776 1.284c.503-.304.665-.861.606-1.299-.062-.455-.42-1.026-1.137-1.026zm9.71 9.495c-.066.107-.156.109-.187.105a.3.3 0 0 1-.155-.082.38.38 0 0 1-.118-.268h1.5c0-.717-.571-1.075-1.026-1.137-.438-.059-.995.103-1.299.606z"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      d="M19.9 2.307a.483.483 0 0 0-.9 0l-.43 1.095a.48.48 0 0 1-.272.274l-1.091.432a.486.486 0 0 0 0 .903l1.091.432c.125.049.223.148.272.273L19 6.81c.162.41.74.41.9 0l.43-1.095a.48.48 0 0 1 .273-.273l1.091-.432a.486.486 0 0 0 0-.903l-1.091-.432a.48.48 0 0 1-.273-.274zM16.033 8.13a.483.483 0 0 0-.9 0l-.157.399a.48.48 0 0 1-.272.273l-.398.158a.486.486 0 0 0 0 .903l.398.157c.125.05.223.148.272.274l.157.399c.161.41.739.41.9 0l.157-.4a.48.48 0 0 1 .272-.273l.398-.157a.486.486 0 0 0 0-.903l-.398-.158a.48.48 0 0 1-.272-.273z"
    />
  </svg>
)
export { MoonIcon }

const UploadIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M17 9.002c2.175.012 3.353.109 4.121.877C22 10.758 22 12.172 22 15v1c0 2.829 0 4.243-.879 5.122C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.878C2 20.242 2 18.829 2 16v-1c0-2.828 0-4.242.879-5.121.768-.768 1.946-.865 4.121-.877"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 15V2m0 0 3 3.5M12 2 9 5.5"
    />
  </svg>
)
export { UploadIcon }

const ListIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19.9 13.5H4.1c-1.5 0-2.1.64-2.1 2.23v4.04C2 21.36 2.6 22 4.1 22h15.8c1.5 0 2.1-.64 2.1-2.23v-4.04c0-1.59-.6-2.23-2.1-2.23Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12.9 2H4.1C2.6 2 2 2.64 2 4.23v4.04c0 1.59.6 2.23 2.1 2.23h8.8c1.5 0 2.1-.64 2.1-2.23V4.23C15 2.64 14.4 2 12.9 2Z"
      opacity={0.4}
    />
  </svg>
)
export { ListIcon }

const AudioIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M8 15.187c0-.578 0-.867-.069-1.097a1.529 1.529 0 0 0-1.095-1.059c-.225-.054-.5-.03-1.052.015-.956.079-1.435.118-1.825.27-.899.347-1.585 1.123-1.846 2.088C2 15.823 2 16.324 2 17.328v.186c0 1.03 0 1.544.123 1.979a3.102 3.102 0 0 0 1.588 1.944c.392.195.878.275 1.85.436.645.106.968.16 1.229.106a1.521 1.521 0 0 0 1.119-1C8 20.718 8 20.376 8 19.693v-4.506ZM16 15.187c0-.578 0-.867.069-1.097.16-.531.576-.934 1.095-1.059.225-.054.5-.03 1.051.015.957.079 1.436.118 1.826.27.899.347 1.585 1.123 1.846 2.088.113.419.113.92.113 1.924v.186c0 1.03 0 1.544-.123 1.979a3.103 3.103 0 0 1-1.588 1.944c-.392.195-.878.275-1.85.436-.645.106-.968.16-1.229.106a1.521 1.521 0 0 1-1.119-1C16 20.718 16 20.376 16 19.693v-4.506Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M22 17v-5c0-4.714 0-7.071-1.465-8.536C19.072 2 16.714 2 12 2S4.929 2 3.464 3.464C2 4.93 2 7.286 2 12v5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 6.5v5M15 8v2M9 8v2"
    />
  </svg>
)
export { AudioIcon }

const MoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M9 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM17 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
  </svg>
)
export { MoreIcon }

const ShareItemIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m16.155 3.434 2.357 2.043c1.623 1.406 2.434 2.11 2.434 3.023 0 .913-.811 1.616-2.434 3.023l-2.357 2.043c-.714.618-1.07.927-1.363.794-.292-.134-.292-.606-.292-1.55v-1.524c-3 0-6.25 1.393-7.5 3.714 0-7.429 4.444-9.286 7.5-9.286V4.19c0-.944 0-1.416.292-1.55.293-.133.65.176 1.363.794Z"
    />
  </svg>
)
export { ShareItemIcon }

const EditIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M22 10.5V12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2h1.5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="m17.3 2.806-.648.65-5.965 5.964c-.404.404-.606.606-.78.829-.205.262-.38.547-.524.848-.121.255-.211.526-.392 1.068L8.412 13.9l-.374 1.123a.742.742 0 0 0 .94.939l1.122-.374 1.735-.579c.542-.18.813-.27 1.068-.392.301-.144.586-.32.848-.524.223-.174.425-.376.83-.78l5.964-5.965.649-.649A2.753 2.753 0 0 0 17.3 2.806Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M16.652 3.455s.081 1.379 1.298 2.595c1.216 1.217 2.595 1.298 2.595 1.298M10.1 15.588 8.413 13.9"
      opacity={0.5}
    />
  </svg>
)
export { EditIcon }

const DownloadIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M17 9.002c2.175.012 3.353.109 4.121.877C22 10.758 22 12.172 22 15v1c0 2.829 0 4.243-.879 5.122C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.878C2 20.242 2 18.829 2 16v-1c0-2.828 0-4.242.879-5.121.768-.768 1.946-.865 4.121-.877"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 2v13m0 0-3-3.5m3 3.5 3-3.5"
    />
  </svg>
)
export { DownloadIcon }

const CopyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M6 11c0-2.828 0-4.243.879-5.121C7.757 5 9.172 5 12 5h3c2.828 0 4.243 0 5.121.879C21 6.757 21 8.172 21 11v5c0 2.828 0 4.243-.879 5.121C19.243 22 17.828 22 15 22h-3c-2.828 0-4.243 0-5.121-.879C6 20.243 6 18.828 6 16v-5Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M6 19a3 3 0 0 1-3-3v-6c0-3.771 0-5.657 1.172-6.828C5.343 2 7.229 2 11 2h4a3 3 0 0 1 3 3"
      opacity={0.5}
    />
  </svg>
)
export { CopyIcon }

const ActivityIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M5 15h1.394c.786 0 1.18 0 1.511.177.332.178.55.505.986 1.159l.16.24c.422.633.633.95.92.933.286-.017.459-.356.803-1.036l1.966-3.877c.359-.706.538-1.06.831-1.071.293-.012.5.326.914 1.001l.637 1.04c.43.701.644 1.051.985 1.243.342.19.752.19 1.573.19H19"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
  </svg>
)
export { ActivityIcon }

const InfoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 17v-6"
    />
    <circle
      cx={1}
      cy={1}
      r={1}
      fill="currentColor"
      transform="matrix(1 0 0 -1 11 9)"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
  </svg>
)
export { InfoIcon }

const FileDetailsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="m15.393 4.054-.502.557.502-.557Zm3.959 3.563-.502.557.502-.557Zm2.302 2.537-.685.305.685-.305ZM3.172 20.828l.53-.53-.53.53Zm17.656 0-.53-.53.53.53ZM14 21.25h-4v1.5h4v-1.5ZM2.75 14v-4h-1.5v4h1.5Zm18.5-.437V14h1.5v-.437h-1.5ZM14.891 4.61l3.959 3.563 1.003-1.115-3.958-3.563-1.004 1.115Zm7.859 8.952c0-1.689.015-2.758-.41-3.714l-1.371.61c.266.598.281 1.283.281 3.104h1.5Zm-3.9-5.389c1.353 1.218 1.853 1.688 2.119 2.285l1.37-.61c-.426-.957-1.23-1.66-2.486-2.79L18.85 8.174ZM10.03 2.75c1.582 0 2.179.012 2.71.216l.538-1.4c-.852-.328-1.78-.316-3.248-.316v1.5Zm5.865.746c-1.086-.977-1.765-1.604-2.617-1.93l-.537 1.4c.532.204.98.592 2.15 1.645l1.004-1.115ZM10 21.25c-1.907 0-3.261-.002-4.29-.14-1.005-.135-1.585-.389-2.008-.812l-1.06 1.06c.748.75 1.697 1.081 2.869 1.239 1.15.155 2.625.153 4.489.153v-1.5ZM1.25 14c0 1.864-.002 3.338.153 4.489.158 1.172.49 2.121 1.238 2.87l1.06-1.06c-.422-.424-.676-1.004-.811-2.01-.138-1.027-.14-2.382-.14-4.289h-1.5ZM14 22.75c1.864 0 3.338.002 4.489-.153 1.172-.158 2.121-.49 2.87-1.238l-1.06-1.06c-.424.422-1.004.676-2.01.811-1.027.138-2.382.14-4.289.14v1.5ZM21.25 14c0 1.907-.002 3.262-.14 4.29-.135 1.005-.389 1.585-.812 2.008l1.06 1.06c.75-.748 1.081-1.697 1.239-2.869.155-1.15.153-2.625.153-4.489h-1.5Zm-18.5-4c0-1.907.002-3.261.14-4.29.135-1.005.389-1.585.812-2.008l-1.06-1.06c-.75.748-1.081 1.697-1.239 2.869C1.248 6.661 1.25 8.136 1.25 10h1.5Zm7.28-8.75c-1.875 0-3.356-.002-4.511.153-1.177.158-2.129.49-2.878 1.238l1.06 1.06c.424-.422 1.005-.676 2.017-.811 1.033-.138 2.395-.14 4.312-.14v-1.5Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6 14.5h8M6 18h5.5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M13 2.5V5c0 2.357 0 3.536.732 4.268C14.464 10 15.643 10 18 10h4"
      opacity={0.5}
    />
  </svg>
)
export { FileDetailsIcon }

const HeartIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 5.5C7.5.826 2 4.275 2 9.138 2 14 6.02 16.591 8.962 18.911 10 19.729 11 20.5 12 20.5"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 5.5C16.5.826 22 4.275 22 9.138c0 4.863-4.02 7.454-6.962 9.774C14 19.729 13 20.5 12 20.5"
      opacity={0.5}
    />
  </svg>
)
export { HeartIcon }

const MenuDotsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx={5} cy={12} r={2} stroke="currentColor" strokeWidth={1.5} />
    <circle
      cx={12}
      cy={12}
      r={2}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <circle cx={19} cy={12} r={2} stroke="currentColor" strokeWidth={1.5} />
  </svg>
)
export { MenuDotsIcon }

const MoveToFolder = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M2 12V6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.119.28.255.554.529L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c2.632 0 3.949 0 4.804.77q.119.105.224.224c.77.855.77 2.172.77 4.804V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172-.654-.653-.943-1.528-1.07-2.828"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2 15h11m0 0-4.125-3M13 15l-4.125 3"
    />
  </svg>
)
export { MoveToFolder }

const InfoSquareIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 17v-6"
    />
    <circle
      cx={1}
      cy={1}
      r={1}
      fill="currentColor"
      transform="matrix(1 0 0 -1 11 9)"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
  </svg>
)
export { InfoSquareIcon }

const InfoCircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      cx={12}
      cy={12}
      r={10}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 17v-6"
    />
    <circle
      cx={1}
      cy={1}
      r={1}
      fill="currentColor"
      transform="matrix(1 0 0 -1 11 9)"
    />
  </svg>
)
export { InfoCircleIcon }

const InfoFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M12 17.75a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75ZM12 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
    />
  </svg>
)
export { InfoFillIcon }

const MoreFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M8 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM16 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
    />
    <path
      fill="none"
      d="M3.464 20.535C4.93 22 7.286 22 12 22c4.714 0 7.071 0 8.535-1.465C22 19.072 22 16.714 22 12s0-7.071-1.465-8.536C19.072 2 16.714 2 12 2S4.929 2 3.464 3.464C2 4.93 2 7.286 2 12c0 4.714 0 7.071 1.464 8.535Z"
      // opacity={0.7}
    />
  </svg>
)
export { MoreFillIcon }

const OpenWithIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m13 11 9-9m0 0h-5.344M22 2v5.344"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2"
      opacity={0.5}
    />
  </svg>
)
export { OpenWithIcon }

const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 16c0-2.828 0-4.243.879-5.121C3.757 10 5.172 10 8 10h8c2.828 0 4.243 0 5.121.879C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6 10V8a6 6 0 1 1 12 0v2"
      opacity={0.5}
    />
  </svg>
)
export { LockIcon }

const UnlockedIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 16c0-2.828 0-4.243.879-5.121C3.757 10 5.172 10 8 10h8c2.828 0 4.243 0 5.121.879C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6 10V8a6 6 0 0 1 11.811-1.5"
      opacity={0.5}
    />
  </svg>
)
export { UnlockedIcon }

const VideosIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    {...props}
  >
    <g stroke="currentColor" strokeWidth={1.5}>
      <path
        d="M19.562 7a2.132 2.132 0 0 0-2.1-2.5H6.538a2.132 2.132 0 0 0-2.1 2.5M17.5 4.5c.028-.26.043-.389.043-.496a2 2 0 0 0-1.787-1.993C15.65 2 15.52 2 15.26 2H8.74c-.26 0-.391 0-.497.011a2 2 0 0 0-1.787 1.993c0 .107.014.237.043.496M14.581 13.616c.559.346.559 1.242 0 1.588l-3.371 2.09c-.543.337-1.21-.1-1.21-.794v-4.18c0-.693.667-1.13 1.21-.794l3.371 2.09Z"
        opacity={0.5}
      />
      <path d="M2.384 13.793c-.447-3.164-.67-4.745.278-5.77C3.61 7 5.298 7 8.672 7h6.656c3.374 0 5.062 0 6.01 1.024.947 1.024.724 2.605.278 5.769l-.422 3c-.35 2.48-.525 3.721-1.422 4.464-.897.743-2.22.743-4.867.743h-5.81c-2.646 0-3.97 0-4.867-.743-.897-.743-1.072-1.983-1.422-4.464l-.422-3Z" />
    </g>
  </svg>
)
export { VideosIcon }

const LoaderIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 20v-2.4m0-11.2V4m8 8h-2.4M6.4 12H4"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M17.657 6.343 15.96 8.04m-7.92 7.92-1.697 1.697m0-11.314L8.04 8.04m7.92 7.92 1.697 1.697"
      opacity={0.5}
    />
  </svg>
)
export { LoaderIcon }

const SubmitIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="m18.636 15.67 1.716-5.15c1.5-4.498 2.25-6.747 1.062-7.934s-3.436-.438-7.935 1.062L8.33 5.364C4.7 6.574 2.885 7.18 2.37 8.067a2.72 2.72 0 0 0 0 2.73c.515.888 2.33 1.493 5.96 2.704.584.194.875.291 1.119.454.236.158.439.361.597.597.163.244.26.535.454 1.118 1.21 3.63 1.816 5.446 2.703 5.962.844.49 1.887.49 2.731 0 .887-.516 1.492-2.331 2.703-5.962Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m17.79 6.21-4.211 4.165"
      opacity={0.5}
    />
  </svg>
)
export { SubmitIcon }

const CheckboxIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m8.5 12.5 2 2 5-5"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
  </svg>
)
export { CheckboxIcon }

const UncheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
  </svg>
)
export { UncheckIcon }

const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m7 12.9 3.143 3.6L18 7.5"
    />
  </svg>
)
export { CheckIcon }

const RestoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 4 4 7l3 3"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M4 7h11c1.87 0 2.804 0 3.5.402A3 3 0 0 1 19.598 8.5C20 9.196 20 10.13 20 12s0 2.804-.402 3.5a3 3 0 0 1-1.098 1.098C17.804 17 16.87 17 15 17H8"
      opacity={0.5}
    />
  </svg>
)
export { RestoreIcon }

const PreviewIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M13 22c4.055-.008 6.178-.107 7.535-1.465C22 19.072 22 16.714 22 12s0-7.071-1.465-8.536C19.071 2 16.714 2 12 2S4.929 2 3.464 3.464C2.107 4.822 2.008 6.944 2 11"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m12 12 5-5m0 0h-3.75M17 7v3.75"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 18c0-1.886 0-2.828.586-3.414C3.172 14 4.114 14 6 14c1.886 0 2.828 0 3.414.586C10 15.172 10 16.114 10 18c0 1.886 0 2.828-.586 3.414C8.828 22 7.886 22 6 22c-1.886 0-2.828 0-3.414-.586C2 20.828 2 19.886 2 18Z"
    />
  </svg>
)
export { PreviewIcon }

const DeleteIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="m5.505 11.41.53.53zM3 14.952h-.75zM9.048 21v.75zM11.41 5.505l-.53-.53zm6.555 6.555-5.905 5.905 1.06 1.06 5.905-5.904zm-11.93-.12 5.905-5.905-1.06-1.06-5.905 5.904zm0 6.025c-.85-.85-1.433-1.436-1.812-1.933-.367-.481-.473-.79-.473-1.08h-1.5c0 .749.312 1.375.78 1.99.455.596 1.125 1.263 1.945 2.083zm-1.06-7.086c-.82.82-1.49 1.488-1.945 2.084-.468.614-.78 1.24-.78 1.99h1.5c0-.29.106-.6.473-1.08.38-.498.962-1.083 1.812-1.933zm7.085 7.086c-.85.85-1.435 1.433-1.933 1.813-.48.366-.79.472-1.08.472v1.5c.75 0 1.376-.312 1.99-.78.596-.455 1.264-1.125 2.084-1.945zm-7.085 1.06c.82.82 1.487 1.49 2.084 1.945.614.468 1.24.78 1.989.78v-1.5c-.29 0-.599-.106-1.08-.473-.497-.38-1.083-.962-1.933-1.812zm12.99-12.99c.85.85 1.433 1.436 1.813 1.933.366.481.472.79.472 1.08h1.5c0-.749-.312-1.375-.78-1.99-.455-.596-1.125-1.263-1.945-2.083zm1.06 7.086c.82-.82 1.49-1.488 1.945-2.084.468-.614.78-1.24.78-1.99h-1.5c0 .29-.106.6-.473 1.08-.38.498-.962 1.083-1.812 1.933zm0-8.146c-.82-.82-1.487-1.49-2.084-1.945-.614-.468-1.24-.78-1.989-.78v1.5c.29 0 .599.106 1.08.473.497.38 1.083.962 1.933 1.812zm-7.085 1.06c.85-.85 1.435-1.433 1.933-1.812.48-.367.79-.473 1.08-.473v-1.5c-.75 0-1.376.312-1.99.78-.596.455-1.264 1.125-2.084 1.945z"
    />
    <path
      fill="currentColor"
      d="M13.241 17.844a.75.75 0 0 0 1.06-1.06zM7.216 9.698a.75.75 0 1 0-1.06 1.061zm7.086 7.086L7.216 9.698l-1.06 1.061 7.085 7.085z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9 21h12"
      opacity={0.5}
    />
  </svg>
)
export { DeleteIcon }

const FilesEmptyStateIllustration = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 1024 1024"
    fill="none"
    {...props}
  >
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M399 126c-11.6 2.1-17.9 12-15.6 24.5 1.4 7.4 10.7 14.4 19.2 14.5 5.3 0 13.3-4.1 16.1-8.2 6.1-9.1 4-21.6-4.7-27.8-3.5-2.5-10.2-3.8-15-3zm9.6 10.8c7 5.6 5.3 15.4-3.1 18.2-2.8.9-4.1.8-6.9-.5-10-4.7-7.1-19.5 3.8-19.5 2.4 0 5 .8 6.2 1.8zM510.8 153.1c-1.4.8-1.8 2.3-1.8 6.4v5.5h-4.9c-6.7 0-8.1.7-8.1 4s1.4 4 8 4h4.9l.3 5.7c.3 5.3.5 5.8 2.7 6.1 3.3.5 5.1-2.1 5.1-7.4v-4.3l5.1-.3c3.6-.2 5.5-.8 6.3-2.1 1.9-3-.4-5.2-6.3-5.5l-5.1-.3v-4.8c0-3.4-.5-5.3-1.8-6.4-2.1-2-2.1-2-4.4-.6zM278.2 170c-11.6 2.4-22.2 10.3-27.1 20.2-4.8 9.5-4.3 21.8 1.1 27.5 4.3 4.6 12.9 3.8 16.3-1.3 1.2-1.9 1.4-3.8 1-8.2-.6-5-.4-6.2 1.7-9.2 1.3-1.9 3.9-4.5 5.8-5.8 9.1-6.2 24 1.8 24 12.7 0 4.2-1.4 6.5-8.6 14.2-6.6 7-8.2 11.7-6.5 19.2 1.7 7.7 5.1 12.3 9.7 13 4.5.7 9.8-1.3 11.4-4.4.8-1.4 1-4 .6-7.1-.7-4.9-.7-5 4.8-10.8 6.9-7.5 9.8-14.8 9.9-24.5 0-5.6-.5-8.3-2.5-12.5-6.8-14.6-16.9-22.1-31.5-23.4-3.2-.3-7.7-.1-10.1.4zM306.3 256.7c-3.7.7-7.3 5.9-7.3 10.5 0 8.6 10 13 16.8 7.3 8.4-7.1 1.5-20-9.5-17.8zM349 306.6c-11.7 3.1-22.1 13.2-26 25.3l-2.1 6.6.3 188.5.3 188.5 2.4 6c3.3 8.3 13.3 18.3 21.6 21.6l6 2.4 98.1.3 98 .2 1.8 5.8c2.6 8 7.9 18.4 14.2 27.4l5.4 7.7-3.2.3c-3.8.4-5.8 3-4.2 5.5.9 1.4 2.8 1.9 8.4 2.1 7 .3 7.5.5 12.4 4.6 11.3 9.6 25.5 16.9 41.3 21.4 9 2.4 11.2 2.7 27.3 2.6 15.8 0 18.5-.3 27.5-2.7 5.5-1.5 14.6-4.9 20.1-7.6l10.2-4.9 3.6 3.7c2.8 2.9 3.3 4 2.4 4.9-1 1 0 2.5 4.3 7 3 3.1 11.6 12.4 18.9 20.7 19.7 22 45.8 50.5 50.2 54.6 4 3.9 11.1 6.9 16.2 6.9 12 0 21.6-9.5 21.6-21.1 0-9.8 1.6-7.8-61.8-76.2-14.5-15.7-17.6-18.6-18.9-17.6-1.2 1-2.2.5-5.5-2.9l-4.2-4.1 4.6-6.9c32.3-48.5 21.7-112-24.5-146.9-13.7-10.4-32-18-49.1-20.5l-8.6-1.2V386.5l-40.1-40.8-40.1-40.7-111.6.1c-94.4 0-112.6.3-117.2 1.5zm221.2 35.6.3 29.3 3 5.4c3.4 6.2 7.3 9.5 14.5 12.2 4.5 1.7 7.8 1.9 33.5 1.9H650v217.7l-8.8.6c-13 .9-26.8 4.9-39.2 11.2l-10.7 5.5h-112c-111.8 0-112 0-113.9 2.1-1.4 1.5-1.6 2.4-.7 3.7.9 1.6 8.8 1.7 108.2 2 58.9.1 107.1.3 107.1.5 0 .1-2.8 3.2-6.3 6.8-3.4 3.5-8.4 9.7-11.1 13.7l-5 7.2h-94.8c-93.5 0-94.8 0-96.8 2-2.4 2.4-2.5 3.3-.3 5.1 1.3 1.2 17.4 1.4 94.2 1.6 50.9.1 92.7.3 92.8.3.2 0-.7 2.4-1.8 5.2-1.1 2.9-3.1 9.1-4.3 13.8l-2.3 8.5-89.3.5c-84.8.5-89.3.6-90.4 2.3-.9 1.5-.7 2.2 1.3 3.8 2.3 1.8 4.7 1.9 90 1.9h87.7v7.7c-.1 4.3.3 11.3.7 15.6l.8 7.7-95.8-.2-95.8-.3-5.1-2.3c-6.4-2.9-12.6-9.2-15.6-15.7l-2.3-5-.3-187.5c-.2-207.1-.7-193.3 6.1-202.2 4-5.2 10.8-9.5 16.7-10.7 2.5-.5 52.3-.9 110.7-1l106.2-.1.3 29.2zM662 617c23.9 3 44.1 13.1 60.6 30.2 9.8 10.2 13.4 15.3 18.9 27.1 7.2 15.2 8.9 23.5 8.9 42.2 0 18.7-1.7 27-8.9 42.2-7.6 16.2-16.1 26.8-29.4 36.9-57.5 43.5-140 15.1-157.7-54.5-11.7-45.7 10-93.3 52.1-114.1 18.6-9.2 36.2-12.3 55.5-10zm71.8 177.3 3.2 3.3-7 5.9c-3.9 3.3-7.5 6.1-7.9 6.3-.5.2-2.1-1.3-3.6-3.2l-2.7-3.6 3.3-2.7c1.9-1.6 5-4.3 6.9-6 1.9-1.8 3.7-3.3 4.1-3.3.3 0 1.9 1.5 3.7 3.3z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      opacity={0.5}
      d="M355.2 338.2c-2.5 2.5-1.1 5.4 6.5 13l7.8 7.8-7.8 7.8c-7.7 7.7-8.8 9.7-6.5 12 2.5 2.5 5.4 1.1 12.8-6.3l7.5-7.5 7.5 7.5c5.7 5.6 8.2 7.5 10.3 7.5 2 0 2.8-.6 3.3-2.6.6-2.3-.3-3.6-7.2-10.5l-7.8-7.8 7.7-8c7.5-7.7 8.9-10.5 6.5-12.9-2.4-2.4-5.1-1-12 6.3-3.9 4.1-7.5 7.5-8.1 7.5-.5 0-4.4-3.4-8.6-7.5-7.8-7.5-9.7-8.5-11.9-6.3zM424.4 433.9c-6.4 2.9-9 10-5.9 16.1 3.4 6.5 10.9 8.9 17.5 5.5 5.8-3 7.7-11.2 4-17.2-3.4-5.6-9.3-7.3-15.6-4.4zM542.3 433.1c-4.6 1.4-8.3 6.2-8.3 11 0 8 4.9 12.9 13 12.9 3.2 0 4.8-.7 7.5-3.3 6.8-6.2 5.3-16.1-2.9-19.8-4.6-2.1-4.8-2.1-9.3-.8zM474.8 462.9c-8.3 2.7-13.8 6.2-20.1 13-5.8 6.3-9.6 13.4-11.6 21.4-1.4 5.6-.4 7.7 3.5 7.7 2.4 0 4.4-2.5 4.4-5.7 0-3.7 5.9-14.1 10.7-18.9 2.8-2.8 7.7-6.3 10.9-7.9 5.2-2.5 7-2.9 15.4-2.9 8.6-.1 10.1.2 16.1 3 11.1 5.3 19.3 15.3 22.3 27.3 1.1 4.1 1.5 4.6 4.4 4.9 2.6.3 3.2-.1 3.7-2.1 2.2-8.7-10.2-28.3-22.3-35.4-10.6-6.3-25.9-8-37.4-4.4zM365.2 556.2c-1.6 1.6-1.5 3.3.4 5.2 1.4 1.4 14 1.6 124.4 1.6 121.9 0 122.9 0 124-2 .8-1.4.8-2.6 0-4-1.1-2-2.1-2-124.3-2-94.6 0-123.6.3-124.5 1.2zM365.2 592.2c-1.6 1.6-1.5 3.3.4 5.2 1.4 1.4 14 1.6 123.9 1.6s122.5-.2 123.9-1.6c1.9-1.9 2-3.6.4-5.2-1.7-1.7-246.9-1.7-248.6 0zM639.5 637.6c-25.8 4.2-47.6 20.1-59.5 43.4-5.9 11.6-7.5 19.1-7.5 35 0 17.2 1.3 23.1 8.2 37 4 8.1 6.2 10.9 14.3 19 17.9 17.9 36 25 60.5 23.7 39.1-2 69.6-30.7 74.7-70.4 1.8-13.7-1.4-31-8.2-44.3-10.1-19.9-29.5-35.6-50.7-41.1-7.7-2-25.6-3.2-31.8-2.3zm10.3 43.6-.3 36.3-2.9 5.3c-3.4 6-8.1 10.2-14.7 12.9-3.8 1.6-7.4 1.8-26.9 1.8h-22.4l-1.3-5.5c-1.8-7.6-1.7-25.1.2-32.5 2.5-9.8 9.7-23.3 16.5-30.7 12.4-13.7 32.2-23.4 48.3-23.7l3.8-.1-.3 36.2zm18.2-33.6c18.5 4.3 36 17.7 45.4 34.8 6 10.7 8.8 21.6 8.9 33.6.1 12.9-1.9 21.5-7.5 33-5.5 11.1-18.7 24.7-29.3 30.2-12.6 6.5-20.2 8.3-35 8.3-11.5-.1-13.9-.4-20.9-2.8-16.6-5.8-31.7-17.8-39.9-31.8l-3.7-6.4 22.2-.5 22.3-.5 6.5-3.1c7.9-3.7 14-9.7 17.6-17.1 2.4-4.8 2.8-7.2 3.5-19.2.4-7.5.5-24.1.2-36.9-.6-26.6-1.6-24.3 9.7-21.6zM281.6 350.6c-2.1 2-2 3.8.1 6 1.4 1.4 2.9 1.5 8.2 1 3.7-.3 8.7-.6 11.3-.6 4.2 0 4.8-.3 5.4-2.5 1.2-4.7-.8-5.5-12.7-5.5-8.4 0-11.1.3-12.3 1.6zM259.7 366.5c-2.7 2.6-5.2 10.8-5.2 16.9 0 5.1.3 5.9 2.2 6.7 3.2 1.2 4.9-1 5.6-7 .3-2.7 1.2-6.3 2-7.8 2.6-5.1 2.9-7 1.2-8.7-2-2-3.9-2-5.8-.1zM825.8 406.1c-1.3.7-1.8 2.3-1.8 5.9v5h-5.4c-5.9 0-8 1.4-7.4 5.2.3 2.1.9 2.3 6.6 2.6l6.2.3v5.4c0 4.3.4 5.6 1.9 6.5 2.5 1.3 2.7 1.3 4.5-.6 1-1 1.6-3.3 1.6-6.5V425h5.3c7.1 0 9.8-2.8 6.1-6.4-1-1-3.3-1.6-6.5-1.6H832v-5c0-3.8-.4-5.2-1.9-6-2.3-1.2-2.2-1.2-4.3.1zM255.2 410.2c-.8.8-1.2 5-1.2 12.5 0 9.7.2 11.4 1.8 12.1 1.9 1 4.3.5 5.4-1.2.4-.6.8-5.8.8-11.7 0-10.7-.7-12.9-4-12.9-.9 0-2.1.5-2.8 1.2zM255.1 455.4c-.8.9-1.1 5.2-.9 12.6.3 9.5.6 11.5 2.1 12.4 1.2.8 2.2.8 3.5 0 1.4-.9 1.7-2.9 2-12.4.3-11.6-.4-14-3.8-14-1 0-2.3.6-2.9 1.4zM862.1 481.1c-7.7 3.1-12.1 9.6-12.1 18 0 7.5 3.4 12.9 10.2 16.3 8 4 15.1 3 21.7-2.9 9.5-8.6 7.3-24.8-4.1-30.4-4.7-2.2-11.6-2.7-15.7-1zm14.5 10.3c4 4 4.5 8.3 1.5 13.2-5.7 9.3-20.1 5.2-20.1-5.8 0-3.2.7-4.7 3.4-7.4 2.8-2.8 4.2-3.4 7.6-3.4 3.4 0 4.8.6 7.6 3.4zM254.7 500.7c-.4.3-.7 5.9-.7 12.4 0 10.5.2 11.9 1.8 12.8 1.4.7 2.5.6 4-.5 2-1.4 2.2-2.4 2.2-12.3 0-7-.4-11.1-1.2-11.9-1.3-1.3-5-1.6-6.1-.5zM255.2 546.2c-1.7 1.7-1.7 22.9 0 24.6 1.6 1.6 3.3 1.5 5.2-.4 1.3-1.2 1.6-3.9 1.6-12.3 0-10.9-.7-13.1-4-13.1-.9 0-2.1.5-2.8 1.2zM204.6 576.6c-1 .9-1.6 3.3-1.6 6v4.4h-4.9c-5.4 0-7.4 1.5-6.9 5.2.3 2.1.9 2.3 6.1 2.6l5.7.3v4.8c0 5.4 1.5 7.4 5.2 6.9 2.1-.3 2.3-.9 2.6-6.1l.3-5.7h5.9c5.6 0 6-.2 6.6-2.7.9-3.5-1.6-5.3-7.8-5.3H211v-4.8c0-6.6-2.9-9.2-6.4-5.6zM255.1 591.4c-.8.9-1.1 5.2-.9 12.6.3 9.5.6 11.5 2.1 12.4 1.2.8 2.2.8 3.5 0 1.4-.9 1.7-2.9 2-12.5.2-9.8 0-11.5-1.5-12.6-2.2-1.7-3.8-1.6-5.2.1zM255.2 637.2c-.8.8-1.2 5-1.2 12.5 0 10.1.2 11.3 1.9 12.3 2.5 1.3 2.7 1.3 4.5-.6 1.3-1.2 1.6-3.9 1.6-12.3 0-10.9-.7-13.1-4-13.1-.9 0-2.1.5-2.8 1.2zM165.5 664.9c-5.2 2.3-10.1 8-11.5 13.3-5.1 18.8 17 33.1 32.8 21.1 5.3-4 7.5-9.4 7-17.4-.3-5.7-.8-7.4-3.4-10.6-6.1-7.7-16.4-10.3-24.9-6.4zm14.5 7.7c6 3.6 8 12.6 3.9 17.8-6.3 8-17.1 7-21.1-2-4.8-11 6.9-21.8 17.2-15.8zM255.7 682.2c-1.4.8-1.7 2.7-1.7 12.7 0 13.3.9 15.4 5.5 13.3 2.4-1.1 2.5-1.4 2.5-12.4 0-6.2-.4-11.8-.8-12.4-1.1-1.7-3.7-2.3-5.5-1.2zM255.8 728.1c-1.6.9-1.8 2.6-1.8 12.9 0 10.8.2 12 1.9 13 2.5 1.3 2.7 1.3 4.5-.6 2.3-2.3 2.3-22.5 0-24.8-1.8-1.9-2.3-1.9-4.6-.5zM260.6 773.6c-.9.8-1.6 2.3-1.6 3.3 0 2.2 11.8 13.7 15.5 15.1 3.2 1.2 6.1.6 6.9-1.6.9-2.2-.2-3.7-6-8-2.8-2.2-6.4-5.4-7.9-7.2-3-3.6-4.6-4-6.9-1.6zM299.2 788.2c-.7.7-1.2 1.9-1.2 2.8 0 3.4 2.2 4 13.7 4 10.2 0 11.3-.2 12.3-2 .8-1.4.8-2.6 0-4-1-1.8-2.1-2-12.3-2-7.5 0-11.7.4-12.5 1.2zM342.7 787.6c-1.1 1.1-.8 4.9.5 6.2 1.4 1.4 21.5 1.7 23.6.3.8-.5 1.2-2.1 1-3.7l-.3-2.9-12.1-.3c-6.6-.1-12.3.1-12.7.4zM386 789c-.8 1.4-.8 2.6 0 4 1 1.9 1.9 2 12.7 1.8 9.8-.3 11.8-.6 12.7-2.1.8-1.2.8-2.2 0-3.5-.9-1.4-2.9-1.7-12.7-2-10.8-.2-11.7-.1-12.7 1.8zM430.2 788.2c-.7.7-1.2 1.9-1.2 2.8 0 3.3 2.2 4 13.5 4 7.3 0 11.5-.4 12.3-1.2 1.7-1.7 1.5-5.5-.4-6.2-3-1.1-22.9-.7-24.2.6zM474 789c-.8 1.4-.8 2.6 0 4 1 1.9 1.9 2 12.7 1.8 9.8-.3 11.8-.6 12.7-2.1.8-1.2.8-2.2 0-3.5-.9-1.4-2.9-1.7-12.7-2-10.8-.2-11.7-.1-12.7 1.8zM518.2 788.2c-.6.6-1.2 2-1.2 2.9 0 3.3 2.4 4 14 3.7 9.5-.3 11.5-.6 12.4-2.1.8-1.2.8-2.2 0-3.5-.9-1.4-2.9-1.7-12.5-2-8.1-.2-11.8.1-12.7 1z"
    />
  </svg>
)
export { FilesEmptyStateIllustration }

const ColorSchemeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 6c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.093C3.9 2 4.6 2 6 2c1.4 0 2.1 0 2.635.272a2.5 2.5 0 0 1 1.093 1.093C10 3.9 10 4.6 10 6v12c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 0 1-1.093 1.092C8.1 22 7.4 22 6 22c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C2 20.1 2 19.4 2 18V6Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M7 19H5"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="m13.314 4.929-2.142 2.142c-.579.578-.867.867-1.02 1.235C10 8.673 10 9.082 10 9.9v9.656l8.97-8.97c.99-.99 1.486-1.485 1.671-2.056a2.5 2.5 0 0 0 0-1.545c-.185-.57-.68-1.066-1.67-2.056-.99-.99-1.486-1.485-2.056-1.67a2.5 2.5 0 0 0-1.545 0c-.571.185-1.066.68-2.056 1.67Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M6 22h12c1.4 0 2.1 0 2.635-.273a2.5 2.5 0 0 0 1.092-1.092C22 20.1 22 19.4 22 18c0-1.4 0-2.1-.273-2.635a2.5 2.5 0 0 0-1.092-1.092C20.1 14 19.4 14 18 14h-2.5"
      opacity={0.5}
    />
  </svg>
)
export { ColorSchemeIcon }

const BackIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m13.5 9-3 3 3 3"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
  </svg>
)
export { BackIcon }

const ImagesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2.384 13.793c-.447-3.164-.67-4.745.278-5.77C3.61 7 5.298 7 8.672 7h6.656c3.374 0 5.062 0 6.01 1.024s.724 2.605.278 5.769l-.422 3c-.35 2.48-.525 3.721-1.422 4.464s-2.22.743-4.867.743h-5.81c-2.646 0-3.97 0-4.867-.743s-1.072-1.983-1.422-4.464z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M19.562 7a2.132 2.132 0 0 0-2.1-2.5H6.538a2.132 2.132 0 0 0-2.1 2.5M17.5 4.5c.028-.26.043-.389.043-.496a2 2 0 0 0-1.787-1.993C15.65 2 15.52 2 15.26 2H8.74c-.26 0-.391 0-.497.011a2 2 0 0 0-1.787 1.993c0 .107.014.237.043.496"
      opacity={0.5}
    />
    <circle
      cx={16.5}
      cy={11.5}
      r={1.5}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m20 20-2.884-2.149c-.93-.692-2.316-.761-3.34-.166l-.266.155c-.712.414-1.68.345-2.294-.164l-3.839-3.177c-.766-.634-1.995-.668-2.81-.078l-1.324.96"
      opacity={0.5}
    />
  </svg>
)
export { ImagesIcon }

const Video2Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M21.5 17h-19m19-10h-19M12 17v5m0-20v5m5-4.5V7m0 10v4.5M7 17v4.5m0-19V7"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M14 12c0-.528-.53-.884-1.589-1.596-1.073-.721-1.61-1.082-2.01-.817C10 9.852 10 10.567 10 12s0 2.148.4 2.413.938-.096 2.011-.817C13.471 12.884 14 12.528 14 12Z"
    />
  </svg>
)
export { Video2Icon }

const CircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={1.5} />
  </svg>
)
export { CircleIcon }

const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m11 19 6-7-6-7"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m7 19 6-7-6-7"
      opacity={0.5}
    />
  </svg>
)
export { ChevronRightIcon }

const SuccessIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      cx={12}
      cy={12}
      r={10}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m8.5 12.5 2 2 5-5"
    />
  </svg>
)
export { SuccessIcon }

const RemoveIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      cx={12}
      cy={12}
      r={10}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m14.5 9.5-5 5m0-5 5 5"
    />
  </svg>
)
export { RemoveIcon }

const RenameIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M8.25 15.5a.75.75 0 0 0 1.5 0zm3.414-6.748.498-.56zm-.414 1.673a.75.75 0 0 0 1.5 0zm.498-1.59.56-.497zm-5.412-.083-.498-.56zM5.25 10.425a.75.75 0 0 0 1.5 0zm1.002-1.59-.56-.497zM7 14.75a.75.75 0 0 0 0 1.5zm4 1.5a.75.75 0 0 0 0-1.5zm-3.075-7H9v-1.5H7.925zM9 9.25h1.075v-1.5H9zm.75 6.25v-7h-1.5v7zm.325-6.25c.455 0 .726.001.922.026.177.022.186.052.17.037l.995-1.121c-.3-.268-.651-.364-.98-.405-.31-.038-.691-.037-1.107-.037zm2.675 1.175c0-.416.001-.797-.037-1.107-.041-.329-.137-.68-.405-.98l-1.121.996c-.015-.017.015-.008.037.17.025.195.026.466.026.921zm-1.584-1.112.02.02 1.122-.995a2 2 0 0 0-.146-.146zM7.925 7.75c-.416 0-.797-.001-1.107.037-.329.041-.68.137-.98.405l.996 1.121c-.017.015-.008-.015.17-.037.195-.025.466-.026.921-.026zM6.75 10.425c0-.455.001-.726.026-.922.022-.177.052-.186.037-.17l-1.121-.995c-.268.3-.364.651-.405.98-.038.31-.037.691-.037 1.107zm-.912-2.233q-.077.069-.146.146l1.121.996.02-.02zM7 16.25h4v-1.5H7z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 4h-2C6.229 4 4.343 4 3.172 5.172S2 8.229 2 12s0 5.657 1.172 6.828S6.229 20 10 20h2m3-16c3.114.01 4.765.108 5.828 1.172C22 6.343 22 8.229 22 12s0 5.657-1.172 6.828C19.765 19.892 18.114 19.99 15 20"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 2v20"
    />
  </svg>
)
export { RenameIcon }

const HomeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12.204c0-2.289 0-3.433.52-4.381.518-.949 1.467-1.537 3.364-2.715l2-1.241C9.889 2.622 10.892 2 12 2s2.11.622 4.116 1.867l2 1.241c1.897 1.178 2.846 1.766 3.365 2.715S22 9.915 22 12.203v1.522c0 3.9 0 5.851-1.172 7.063S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.212S2 17.626 2 13.725z"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 18H9"
    />
  </svg>
)
export { HomeIcon }

const RefreshIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M12.079 3v-.75zm-8.4 8.333h-.75zm0 1.667-.527.532a.75.75 0 0 0 1.056 0zm2.209-1.134A.75.75 0 1 0 4.83 10.8zM2.528 10.8a.75.75 0 0 0-1.056 1.065zm16.088-3.408a.75.75 0 1 0 1.277-.786zM12.079 2.25c-5.047 0-9.15 4.061-9.15 9.083h1.5c0-4.182 3.42-7.583 7.65-7.583zm-9.15 9.083V13h1.5v-1.667zm1.28 2.2 1.679-1.667L4.83 10.8l-1.68 1.667zm0-1.065L2.528 10.8l-1.057 1.065 1.68 1.666zm15.684-5.86A9.16 9.16 0 0 0 12.08 2.25v1.5a7.66 7.66 0 0 1 6.537 3.643z"
    />
    <path
      fill="currentColor"
      d="M11.883 21v.75zm8.43-8.333h.75zm0-1.667.528-.533a.75.75 0 0 0-1.055 0zM18.1 12.133a.75.75 0 1 0 1.055 1.067zm3.373 1.067a.75.75 0 1 0 1.054-1.067zM5.318 16.606a.75.75 0 1 0-1.277.788zm6.565 5.144c5.062 0 9.18-4.058 9.18-9.083h-1.5c0 4.18-3.43 7.583-7.68 7.583zm9.18-9.083V11h-1.5v1.667zm-1.277-2.2L18.1 12.133l1.055 1.067 1.686-1.667zm0 1.066 1.687 1.667 1.054-1.067-1.686-1.666zm-15.745 5.86a9.2 9.2 0 0 0 7.842 4.357v-1.5a7.7 7.7 0 0 1-6.565-3.644z"
      opacity={0.5}
    />
  </svg>
)
export { RefreshIcon }

const ExpandCollapsedIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 4v16l-6-5.5"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14 20V4l6 5.5"
      opacity={0.5}
    />
  </svg>
)
export { ExpandCollapsedIcon }

const LoadMoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M7 12H6c-1.886 0-2.828 0-3.414.586S2 14.114 2 16v2c0 1.886 0 2.828.586 3.414S4.114 22 6 22h2c1.886 0 2.828 0 3.414-.586S12 19.886 12 18v-1"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M12 7h-1c-1.886 0-2.828 0-3.414.586S7 9.114 7 11v2c0 1.886 0 2.828.586 3.414S9.114 17 11 17h2c1.886 0 2.828 0 3.414-.586S17 14.886 17 13v-1"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M12 6c0-1.886 0-2.828.586-3.414S14.114 2 16 2h2c1.886 0 2.828 0 3.414.586S22 4.114 22 6v2c0 1.886 0 2.828-.586 3.414S19.886 12 18 12h-2c-1.886 0-2.828 0-3.414-.586S12 9.886 12 8z"
    />
  </svg>
)
export { LoadMoreIcon }

const AIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="m13.087 21.388.645.382zm.542-.916-.646-.382zm-3.258 0-.645.382zm.542.916.646-.382zm-8.532-5.475.693-.287zm5.409 3.078-.013.75zm-2.703-.372-.287.693zm16.532-2.706.693.287zm-5.409 3.078-.012-.75zm2.703-.372.287.693zm.7-15.882-.392.64zm1.65 1.65.64-.391zM4.388 2.738l-.392-.64zm-1.651 1.65-.64-.391zM9.403 19.21l.377-.649zm4.33 2.56.541-.916-1.29-.764-.543.916zm-4.007-.916.542.916 1.29-.764-.541-.916zm2.715.152a.52.52 0 0 1-.882 0l-1.291.764c.773 1.307 2.69 1.307 3.464 0zM10.5 2.75h3v-1.5h-3zm10.75 7.75v1h1.5v-1zm-18.5 1v-1h-1.5v1zm-1.5 0c0 1.155 0 2.058.05 2.787.05.735.153 1.347.388 1.913l1.386-.574c-.147-.352-.233-.782-.278-1.441-.046-.666-.046-1.51-.046-2.685zm6.553 6.742c-1.256-.022-1.914-.102-2.43-.316L4.8 19.313c.805.334 1.721.408 2.977.43zM1.688 16.2A5.75 5.75 0 0 0 4.8 19.312l.574-1.386a4.25 4.25 0 0 1-2.3-2.3zm19.562-4.7c0 1.175 0 2.019-.046 2.685-.045.659-.131 1.089-.277 1.441l1.385.574c.235-.566.338-1.178.389-1.913.05-.729.049-1.632.049-2.787zm-5.027 8.241c1.256-.021 2.172-.095 2.977-.429l-.574-1.386c-.515.214-1.173.294-2.428.316zm4.704-4.115a4.25 4.25 0 0 1-2.3 2.3l.573 1.386a5.75 5.75 0 0 0 3.112-3.112zM13.5 2.75c1.651 0 2.837 0 3.762.089.914.087 1.495.253 1.959.537l.783-1.279c-.739-.452-1.577-.654-2.6-.752-1.012-.096-2.282-.095-3.904-.095zm9.25 7.75c0-1.622 0-2.891-.096-3.904-.097-1.023-.299-1.862-.751-2.6l-1.28.783c.285.464.451 1.045.538 1.96.088.924.089 2.11.089 3.761zm-3.53-7.124a4.25 4.25 0 0 1 1.404 1.403l1.279-.783a5.75 5.75 0 0 0-1.899-1.899zM10.5 1.25c-1.622 0-2.891 0-3.904.095-1.023.098-1.862.3-2.6.752l.783 1.28c.464-.285 1.045-.451 1.96-.538.924-.088 2.11-.089 3.761-.089zM2.75 10.5c0-1.651 0-2.837.089-3.762.087-.914.253-1.495.537-1.959l-1.279-.783c-.452.738-.654 1.577-.752 2.6C1.25 7.61 1.25 8.878 1.25 10.5zm1.246-8.403a5.75 5.75 0 0 0-1.899 1.899l1.28.783a4.25 4.25 0 0 1 1.402-1.403zm7.02 17.993c-.202-.343-.38-.646-.554-.884a2.2 2.2 0 0 0-.682-.645l-.754 1.297c.047.028.112.078.224.232.121.166.258.396.476.764zm-3.24-.349c.44.008.718.014.93.037.198.022.275.054.32.08l.754-1.297c-.293-.17-.598-.24-.909-.274-.298-.033-.657-.038-1.069-.045zm6.498 1.113c.218-.367.355-.598.476-.764.112-.154.177-.204.224-.232l-.754-1.297c-.29.17-.5.395-.682.645-.173.238-.352.54-.555.884zm1.924-2.612c-.412.007-.771.012-1.069.045-.311.035-.616.104-.909.274l.754 1.297c.045-.026.122-.058.32-.08.212-.023.49-.03.93-.037z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 15V7M8 13V9M16 13V9"
      opacity={0.5}
    />
  </svg>
)
export { AIcon }

const LanguageIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M15.25 9.222a.75.75 0 0 0 1.5 0zm-8 0a.75.75 0 1 0 1.5 0zm4 .278a.75.75 0 0 0 1.5 0zm0 7.5a.75.75 0 0 0 1.5 0zm1.5-2.5a.75.75 0 0 0-1.5 0zm2.957-7.175-.557.502zM9.5 16.25a.75.75 0 0 0 0 1.5zm5 1.5a.75.75 0 0 0 0-1.5zM8 11.25a.75.75 0 0 0 0 1.5zm8 1.5a.75.75 0 0 0 0-1.5zm-6-5h2v-1.5h-2zm2 0h2v-1.5h-2zm.75 1.75V7h-1.5v2.5zm0 7.5v-2.5h-1.5V17zM14 7.75c.495 0 .782.002.986.032.092.014.135.03.152.037.01.005.01.006.012.008l1.115-1.003c-.305-.339-.686-.47-1.057-.525-.34-.051-.76-.049-1.208-.049zm2.75 1.472c0-.504.001-.95-.042-1.31-.045-.371-.149-.761-.443-1.088L15.15 7.827c.002.003.01.012.023.045.014.038.032.105.046.221.03.247.031.586.031 1.13zM10 6.25c-.448 0-.868-.002-1.208.049-.371.055-.752.186-1.057.525L8.85 7.827c.002-.002.002-.003.012-.008a.6.6 0 0 1 .152-.037c.204-.03.491-.032.986-.032zM8.75 9.222c0-.543.001-.882.031-1.129.014-.116.032-.183.046-.22.012-.034.02-.043.023-.046L7.735 6.824c-.294.327-.398.717-.443 1.089-.043.358-.042.805-.042 1.31zm.75 8.528h5v-1.5h-5zm-1.5-5h8v-1.5H8z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
  </svg>
)
export { LanguageIcon }

const MicIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M7 8a5 5 0 0 1 10 0v3a5 5 0 0 1-10 0z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M11 8h2M10 11h4M20 10v1a8 8 0 0 1-8 8m-8-9v1a8 8 0 0 0 8 8m0 0v3"
      opacity={0.5}
    />
  </svg>
)
export { MicIcon }

const MediaIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2"
    />
    <path
      stroke="currentColor"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 22C6.477 22 2 17.523 2 12S6.977 2 12.5 2"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M13.888 9.935C14.963 10.812 15.5 11.25 15.5 12s-.537 1.188-1.612 2.065c-.297.242-.591.47-.862.66-.237.167-.506.339-.784.508-1.073.652-1.609.978-2.09.617-.48-.36-.524-1.116-.612-2.628-.024-.427-.04-.846-.04-1.222s.016-.795.04-1.222c.088-1.512.132-2.267.612-2.628.481-.361 1.018-.035 2.09.617.278.169.547.341.784.508.27.19.565.418.862.66Z"
    />
  </svg>
)
export { MediaIcon }

const SummarizeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="m18.18 8.04.463-.464a1.966 1.966 0 1 1 2.781 2.78l-.463.464M18.18 8.04s.058.984.927 1.853 1.854.927 1.854.927M18.18 8.04l-4.26 4.26c-.29.288-.434.433-.558.592q-.22.282-.374.606c-.087.182-.151.375-.28.762l-.413 1.24-.134.401m8.8-5.081-4.26 4.26c-.29.29-.434.434-.593.558q-.282.22-.606.374c-.182.087-.375.151-.762.28l-1.24.413-.401.134m0 0-.401.134a.53.53 0 0 1-.67-.67l.133-.402m.938.938-.938-.938"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 13h2.5M8 9h6.5M8 17h1.5"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3 10c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h2c3.771 0 5.657 0 6.828 1.172S21 6.229 21 10v4c0 3.771 0 5.657-1.172 6.828S16.771 22 13 22h-2c-3.771 0-5.657 0-6.828-1.172S3 17.771 3 14z"
      opacity={0.5}
    />
  </svg>
)
export { SummarizeIcon }

// ─── AI Pipeline Icons (Line Duotone) ────────────────────────────────────────

// Keywords — targeting reticle scanning text lines
const AiKeywordsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M8.25 15.5a.75.75 0 0 0 1.5 0zm3.414-6.748.498-.56zm-.414 1.673a.75.75 0 0 0 1.5 0zm.498-1.59.56-.497zm-5.412-.083-.498-.56zM5.25 10.425a.75.75 0 0 0 1.5 0zm1.002-1.59-.56-.497zM7 14.75a.75.75 0 0 0 0 1.5zm4 1.5a.75.75 0 0 0 0-1.5zm-3.075-7H9v-1.5H7.925zM9 9.25h1.075v-1.5H9zm.75 6.25v-7h-1.5v7zm.325-6.25c.455 0 .726.001.922.026.177.022.186.052.17.037l.995-1.121c-.3-.268-.651-.364-.98-.405-.31-.038-.691-.037-1.107-.037zm2.675 1.175c0-.416.001-.797-.037-1.107-.041-.329-.137-.68-.405-.98l-1.121.996c-.015-.017.015-.008.037.17.025.195.026.466.026.921zm-1.584-1.112.02.02 1.122-.995a2 2 0 0 0-.146-.146zM7.925 7.75c-.416 0-.797-.001-1.107.037-.329.041-.68.137-.98.405l.996 1.121c-.017.015-.008-.015.17-.037.195-.025.466-.026.921-.026zM6.75 10.425c0-.455.001-.726.026-.922.022-.177.052-.186.037-.17l-1.121-.995c-.268.3-.364.651-.405.98-.038.31-.037.691-.037 1.107zm-.912-2.233q-.077.069-.146.146l1.121.996.02-.02zM7 16.25h4v-1.5H7z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 4h-2C6.229 4 4.343 4 3.172 5.172S2 8.229 2 12s0 5.657 1.172 6.828S6.229 20 10 20h2m3-16c3.114.01 4.765.108 5.828 1.172C22 6.343 22 8.229 22 12s0 5.657-1.172 6.828C19.765 19.892 18.114 19.99 15 20"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 2v20"
    />
  </svg>
)
export { AiKeywordsIcon }

// Tags — content hub radiating out to satellite label nodes
const AiTagsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="m20.312 12.647.517-1.932c.604-2.255.907-3.382.68-4.358a4 4 0 0 0-1.162-2.011c-.731-.685-1.859-.987-4.114-1.591-2.255-.605-3.383-.907-4.358-.68a4 4 0 0 0-2.011 1.162c-.587.626-.893 1.543-1.348 3.209l-.244.905-.517 1.932c-.605 2.255-.907 3.382-.68 4.358a4 4 0 0 0 1.162 2.011c.731.685 1.859.987 4.114 1.592 2.032.544 3.149.843 4.064.73q.15-.019.294-.052a4 4 0 0 0 2.011-1.16c.685-.732.987-1.86 1.592-4.115Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M16.415 17.974a4 4 0 0 1-1.068 1.678c-.731.685-1.859.987-4.114 1.591s-3.383.907-4.358.679a4 4 0 0 1-2.011-1.161c-.685-.731-.988-1.859-1.592-4.114l-.517-1.932c-.605-2.255-.907-3.383-.68-4.358a4 4 0 0 1 1.162-2.011c.731-.685 1.859-.987 4.114-1.592q.638-.172 1.165-.309"
      opacity={0.5}
    />
  </svg>
)
export { AiTagsIcon }

// Sentiment — emotional spectrum: smile arc / frown arc / needle reading
const AiSentimentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    {/* horizontal axis — secondary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M4 13h16"
      opacity={0.5}
    />
    {/* positive arc above axis — secondary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M5 13A7 7 0 0 1 19 13"
      opacity={0.5}
    />
    {/* negative arc below axis — secondary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 13A4 4 0 0 0 16 13"
      opacity={0.5}
    />
    {/* needle pointing into positive zone — primary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 13 9 7.5"
    />
    {/* pivot — primary */}
    <circle cx={12} cy={13} r={1} fill="currentColor" />
  </svg>
)
export { AiSentimentIcon }

// Generate — branching tree: single root expanding into many outputs
const AiGenerateIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    {/* leaf nodes — secondary */}
    <circle cx={5} cy={7} r={1} fill="currentColor" opacity={0.5} />
    <circle cx={10} cy={5} r={1} fill="currentColor" opacity={0.5} />
    <circle cx={14} cy={5} r={1} fill="currentColor" opacity={0.5} />
    <circle cx={19} cy={7} r={1} fill="currentColor" opacity={0.5} />
    {/* upper branches — secondary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 11 5 7M8 11 10 5M16 11 14 5M16 11 19 7"
      opacity={0.5}
    />
    {/* trunk + main branches — primary */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 19V14M12 14 8 11M12 14 16 11"
    />
    {/* root — primary */}
    <circle cx={12} cy={19} r={1.5} fill="currentColor" />
  </svg>
)
export { AiGenerateIcon }

const VerifyTranscriptIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M12 4v16"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M16 7v10M8 7v10"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20 11v2M4 11v2"
    />
  </svg>
)
export { VerifyTranscriptIcon }

const PauseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 6c0-1.886 0-2.828.586-3.414S4.114 2 6 2s2.828 0 3.414.586S10 4.114 10 6v12c0 1.886 0 2.828-.586 3.414S7.886 22 6 22s-2.828 0-3.414-.586S2 19.886 2 18z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M14 6c0-1.886 0-2.828.586-3.414S16.114 2 18 2s2.828 0 3.414.586S22 4.114 22 6v12c0 1.886 0 2.828-.586 3.414S19.886 22 18 22s-2.828 0-3.414-.586S14 19.886 14 18z"
      opacity={0.5}
    />
  </svg>
)
export { PauseIcon }

const ResumeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={2}
      d="M16.163 6.837C19.388 9.03 21 10.125 21 12s-1.612 2.97-4.837 5.163a46 46 0 0 1-2.585 1.65c-.711.416-1.518.847-2.352 1.27-3.217 1.63-4.826 2.446-6.269 1.543-1.442-.902-1.574-2.792-1.836-6.57A45 45 0 0 1 3 12c0-.94.047-1.987.121-3.055.262-3.779.393-5.668 1.836-6.57s3.052-.088 6.269 1.542c.834.423 1.64.854 2.352 1.27a46 46 0 0 1 2.585 1.65Z"
    />
  </svg>
)
export { ResumeIcon }

const RemoveSquareIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="m14.5 9.5-5 5m0-5 5 5"
    />
  </svg>
)
export { RemoveSquareIcon }

const CheckSquareIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeWidth={2}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8.5 12.5 2 2 5-5"
    />
  </svg>
)
export { CheckSquareIcon }

const PauseV2Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M2 6c0-1.886 0-2.828.586-3.414S4.114 2 6 2s2.828 0 3.414.586S10 4.114 10 6v12c0 1.886 0 2.828-.586 3.414S7.886 22 6 22s-2.828 0-3.414-.586S2 19.886 2 18z"
    />
    <path
      fill="currentColor"
      d="M14 6c0-1.886 0-2.828.586-3.414S16.114 2 18 2s2.828 0 3.414.586S22 4.114 22 6v12c0 1.886 0 2.828-.586 3.414S19.886 22 18 22s-2.828 0-3.414-.586S14 19.886 14 18z"
      opacity={0.5}
    />
  </svg>
)
export { PauseV2Icon }

const DoubleCheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m4 12.9 3.143 3.6L15 7.5"
    />
    <path
      opacity={0.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m20 7.563-8.571 9L11 16"
    />
  </svg>
)
export { DoubleCheckIcon }
