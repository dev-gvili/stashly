import type { SVGProps } from 'react'

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

const BinariesFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M16.093 4.256A1 1 0 0 0 16 4.25H8a1 1 0 0 0-.093.006 3 3 0 0 1 0 1.488q.045.006.093.006h8a1 1 0 0 0 .093-.006 3 3 0 0 1 0-1.488M19 8q.386 0 .744-.093.006.046.006.093v8a1 1 0 0 1-.006.093 3 3 0 0 0-1.488 0A1 1 0 0 1 18.25 16V8q0-.047.006-.093.358.091.744.093M16.093 18.256A1 1 0 0 0 16 18.25H8a1 1 0 0 0-.093.006 3 3 0 0 1 0 1.488q.045.006.093.006h8a1 1 0 0 0 .093-.006 3 3 0 0 1 0-1.488M5 8q-.386 0-.744-.093A1 1 0 0 0 4.25 8v8q0 .048.006.093a3 3 0 0 1 1.488 0A1 1 0 0 0 5.75 16V8a1 1 0 0 0-.006-.093Q5.386 7.998 5 8" />
    </g>
  </svg>
)
export { BinariesFillIcon }

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

const PresentationFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M15.721 7.349a1.86 1.86 0 1 1-3.721 0 1.86 1.86 0 0 1 3.721 0"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M16.085 2.108C15.28 2 14.253 2 12.981 2H11.02c-1.272 0-2.298 0-3.104.108-.838.113-1.543.354-2.103.914s-.8 1.265-.913 2.102c-.108.806-.108 1.832-.108 3.104v7.544c0 1.272 0 2.298.108 3.104.113.837.354 1.542.913 2.102.56.56 1.265.801 2.103.914C8.72 22 9.747 22 11.019 22h1.962c1.273 0 2.298 0 3.104-.108.838-.113 1.543-.354 2.103-.914s.8-1.265.913-2.102c.108-.806.108-1.832.108-3.104V8.228c0-1.272 0-2.298-.108-3.104-.113-.837-.353-1.542-.913-2.102s-1.265-.801-2.103-.914m.724 14.522.986 1.04c.018-.536.019-1.175.019-1.95V8.28c0-1.336-.002-2.267-.096-2.97-.092-.683-.26-1.044-.517-1.302-.258-.257-.619-.425-1.302-.517-.702-.094-1.633-.096-2.969-.096h-1.86c-1.335 0-2.267.002-2.97.096-.682.092-1.043.26-1.3.517-.258.258-.426.62-.518 1.302-.094.703-.096 1.634-.096 2.97v4.624l.003-.003c.917-.941 2.336-.876 3.184.118l2.94 3.448c.236.276.545.289.783.093l.204-.169c1.076-.886 2.552-.77 3.509.24"
      clipRule="evenodd"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M5.016 4.5H5c-.465 0-.697 0-.891.03A2.5 2.5 0 0 0 2.03 6.61C2 6.803 2 7.035 2 7.5v9c0 .465 0 .697.03.891A2.5 2.5 0 0 0 4.11 19.47c.194.031.426.031.891.031h.016a6 6 0 0 1-.117-.624c-.108-.806-.108-1.832-.108-3.104V8.228c0-1.272 0-2.298.108-3.104q.043-.325.117-.624M18.985 19.5q.074-.299.116-.624c.109-.806.109-1.832.109-3.104V8.228c0-1.272 0-2.298-.109-3.104a6 6 0 0 0-.116-.624H19c.465 0 .697 0 .891.03A2.5 2.5 0 0 1 21.97 6.61c.031.194.031.426.031.891v9c0 .465 0 .697-.03.891a2.5 2.5 0 0 1-2.079 2.078c-.194.031-.426.031-.891.031z" />
    </g>
  </svg>
)
export { PresentationFillIcon }

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

const WorkspaceFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    {/* body */}
    <path
      fill="currentColor"
      opacity={0.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    {/* member dots */}
    <circle cx={8} cy={12} r={1.75} fill="currentColor" />
    <circle cx={12} cy={12} r={1.75} fill="currentColor" opacity={0.7} />
    <circle cx={16} cy={12} r={1.75} fill="currentColor" opacity={0.4} />
  </svg>
)

export { WorkspaceFillIcon }

const WorkspaceMembersFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0"
    />
    <path
      fill="currentColor"
      d="M19.5 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M4.5 7.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M18 16.5c0 1.933-2.686 3.5-6 3.5s-6-1.567-6-3.5S8.686 13 12 13s6 1.567 6 3.5"
    />
    <path
      fill="currentColor"
      d="M22 16.5c0 1.38-1.79 2.5-4 2.5s-4-1.12-4-2.5 1.79-2.5 4-2.5 4 1.12 4 2.5M2 16.5C2 17.88 3.79 19 6 19s4-1.12 4-2.5S8.21 14 6 14s-4 1.12-4 2.5"
      opacity={0.5}
    />
  </svg>
)
export { WorkspaceMembersFillIcon }

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

const DocumentFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3 10c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h2c3.771 0 5.657 0 6.828 1.172S21 6.229 21 10v4c0 3.771 0 5.657-1.172 6.828S16.771 22 13 22h-2c-3.771 0-5.657 0-6.828-1.172S3 17.771 3 14z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.25 12a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75M7.25 8A.75.75 0 0 1 8 7.25h8a.75.75 0 0 1 0 1.5H8A.75.75 0 0 1 7.25 8M7.25 16a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75"
      clipRule="evenodd"
    />
  </svg>
)
export { DocumentFillIcon }

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
      strokeWidth={0.5}
      fill="currentColor"
      d="M17.815 13.65c-.355-.372-1.083-.585-2.112-.585-.55 0-1.189.053-1.88.177a9.722 9.722 0 0 1-1.154-1.33 10.76 10.76 0 0 1-.71-1.119c.408-1.241.604-2.253.604-2.98 0-.816-.302-1.668-1.172-1.668a.823.823 0 0 0-.674.39c-.39.692-.212 2.2.462 3.69a30.139 30.139 0 0 1-.852 2.254 20.7 20.7 0 0 1-.959 2.005c-1.951.781-3.211 1.686-3.353 2.395a.767.767 0 0 0 .231.71c.071.053.32.267.745.267 1.295 0 2.662-2.095 3.353-3.354.533-.178 1.066-.355 1.598-.497a17.482 17.482 0 0 1 1.703-.373c1.366 1.224 2.572 1.42 3.176 1.42.745 0 1.011-.302 1.1-.55a.792.792 0 0 0-.106-.852zm-.71.515c-.054.266-.32.444-.692.444-.107 0-.195-.018-.302-.036-.674-.16-1.313-.497-1.952-1.03a8.858 8.858 0 0 1 1.49-.123c.373 0 .693.017.905.07.249.053.64.213.55.674zm-3.762-.834a19.005 19.005 0 0 0-1.473.337 19.84 19.84 0 0 0-1.26.373 20.025 20.025 0 0 0 .604-1.278c.213-.497.39-1.011.568-1.49.177.301.372.603.567.869a25.064 25.064 0 0 0 .994 1.189zM11.019 6.73a.384.384 0 0 1 .337-.212c.372 0 .444.425.444.763 0 .567-.178 1.437-.48 2.43-.514-1.384-.55-2.537-.301-2.981zm-1.952 8.268c-.905 1.491-1.774 2.414-2.307 2.414a.436.436 0 0 1-.265-.089c-.107-.106-.16-.23-.125-.372.106-.533 1.135-1.278 2.697-1.952z"
    />
    <path
      fill="currentColor"
      opacity={0.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
  </svg>
)
export { Pdf2Icon }

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

const ShareFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <g fill="currentColor" opacity={0.5}>
      <path d="M7.205 7.562a.75.75 0 0 0-.993-1.124A8.73 8.73 0 0 0 3.25 13a.75.75 0 0 0 1.5 0 7.23 7.23 0 0 1 2.455-5.438M17.788 6.438a.75.75 0 0 0-.993 1.124A7.23 7.23 0 0 1 19.25 13a.75.75 0 0 0 1.5 0 8.73 8.73 0 0 0-2.962-6.562M10.187 20.022a.75.75 0 1 0-.374 1.452c.7.18 1.433.276 2.187.276s1.487-.096 2.187-.276a.75.75 0 1 0-.374-1.452A7.3 7.3 0 0 1 12 20.25c-.627 0-1.234-.08-1.813-.228" />
    </g>
    <path
      fill="currentColor"
      d="M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0M2.5 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0M18.5 21a3 3 0 1 1 0-6 3 3 0 0 1 0 6"
    />
  </svg>
)
export { ShareFillIcon }

const SettingsFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M12.428 2c-1.114 0-2.129.6-4.157 1.802l-.686.406C5.555 5.41 4.542 6.011 3.985 7c-.557.99-.557 2.19-.557 4.594v.812c0 2.403 0 3.605.557 4.594s1.57 1.59 3.6 2.791l.686.407C10.299 21.399 11.314 22 12.428 22s2.128-.6 4.157-1.802l.686-.407c2.028-1.2 3.043-1.802 3.6-2.791.557-.99.557-2.19.557-4.594v-.812c0-2.403 0-3.605-.557-4.594s-1.572-1.59-3.6-2.792l-.686-.406C14.555 2.601 13.542 2 12.428 2"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M12.428 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5"
    />
  </svg>
)
export { SettingsFillIcon }

const LogoutFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M15 2h-1c-2.828 0-4.243 0-5.121.879C8 3.757 8 5.172 8 8v8c0 2.828 0 4.243.879 5.121C9.757 22 11.172 22 14 22h1c2.828 0 4.243 0 5.121-.879C21 20.243 21 18.828 21 16V8c0-2.828 0-4.243-.879-5.121C19.243 2 17.828 2 15 2"
      opacity={0.6}
    />
    <path
      fill="currentColor"
      d="M8 8c0-1.538 0-2.657.141-3.5H8c-2.357 0-3.536 0-4.268.732S3 7.143 3 9.5v5c0 2.357 0 3.535.732 4.268S5.643 19.5 8 19.5h.141C8 18.657 8 17.538 8 16V8"
      opacity={0.4}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M4.47 11.47a.75.75 0 0 0 0 1.06l2 2a.75.75 0 0 0 1.06-1.06l-.72-.72H14a.75.75 0 0 0 0-1.5H6.81l.72-.72a.75.75 0 1 0-1.06-1.06z"
      clipRule="evenodd"
    />
  </svg>
)
export { LogoutFillIcon }

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

const LockedFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M15 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14m0-5a2 2 0 1 0 0-4 2 2 0 0 0 0 4"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M10.609 14.452a7 7 0 0 1-1.06-1.06l-6.58 6.578a.75.75 0 1 0 1.061 1.06l.47-.47.97.97a.75.75 0 0 0 1.06-1.06l-.97-.97.94-.94.97.97a.75.75 0 0 0 1.06-1.06l-.97-.97z"
      opacity={0.5}
    />
  </svg>
)
export { LockedFillIcon }

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

const CodeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M13.488 6.446a.75.75 0 0 1 .53.918l-2.588 9.66a.75.75 0 0 1-1.449-.389l2.589-9.659a.75.75 0 0 1 .918-.53M14.97 8.47a.75.75 0 0 1 1.06 0l.209.208c.635.635 1.165 1.165 1.529 1.642.384.504.654 1.036.654 1.68s-.27 1.176-.654 1.68c-.364.477-.894 1.007-1.53 1.642l-.208.208a.75.75 0 1 1-1.06-1.06l.171-.172c.682-.682 1.139-1.14 1.434-1.528.283-.37.347-.586.347-.77s-.064-.4-.347-.77c-.295-.387-.752-.846-1.434-1.528l-.171-.172a.75.75 0 0 1 0-1.06M7.97 8.47a.75.75 0 0 1 1.06 1.06l-.171.172c-.682.682-1.138 1.14-1.434 1.528-.283.37-.346.586-.346.77s.063.4.346.77c.296.387.752.846 1.434 1.528l.172.172a.75.75 0 1 1-1.061 1.06l-.208-.208c-.636-.635-1.166-1.165-1.53-1.642-.384-.504-.653-1.036-.653-1.68s.27-1.176.653-1.68c.364-.477.894-1.007 1.53-1.642z"
    />
  </svg>
)
export { CodeFillIcon }

const GraphicIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    {/* card */}
    <path
      fill="currentColor"
      opacity={0.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
    />
    {/* triangle */}
    <path
      fill="currentColor"
      d="M11.567 6.75a.5.5 0 0 1 .866 0l2.165 3.75a.5.5 0 0 1-.433.75H9.835a.5.5 0 0 1-.433-.75z"
    />
    {/* circle */}
    <circle cx={9} cy={14.5} r={2.5} fill="currentColor" opacity={0.7} />
    {/* square */}
    <rect
      x={12.5}
      y={12}
      width={5}
      height={5}
      fill="currentColor"
      opacity={0.55}
    />
  </svg>
)

export { GraphicIcon }

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

const ShellFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M6.424 9.52a.75.75 0 0 1 1.056-.096l.277.23c.605.504 1.12.933 1.476 1.328.379.42.674.901.674 1.518s-.295 1.099-.674 1.518c-.356.395-.871.824-1.476 1.328l-.277.23a.75.75 0 1 1-.96-1.152l.234-.195c.659-.55 1.09-.91 1.366-1.216.262-.29.287-.427.287-.513s-.025-.222-.287-.513c-.277-.306-.707-.667-1.366-1.216l-.234-.195a.75.75 0 0 1-.096-1.056M17.75 15a.75.75 0 0 1-.75.75h-5a.75.75 0 0 1 0-1.5h5a.75.75 0 0 1 .75.75"
    />
  </svg>
)
export { ShellFillIcon }

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
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20 7H4"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M15 12H4"
      opacity={0.7}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M9 17H4"
      opacity={0.4}
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

const SidebarFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M3.172 4.172C2 5.343 2 7.229 2 11v2c0 3.771 0 5.657 1.172 6.828S6.229 21 10 21h5V3h-5C6.229 3 4.343 3 3.172 4.172"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M22 13v-2c0-3.771 0-5.657-1.172-6.828-.974-.975-3.192-1.139-5.828-1.166v17.988c2.636-.027 4.854-.191 5.828-1.166C22 18.657 22 16.771 22 13"
    />
  </svg>
)
export { SidebarFillIcon }

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

const LightModeFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="currentColor" d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0" />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 1.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75M1.25 12a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75m18 0a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75M12 19.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75"
      clipRule="evenodd"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M3.67 3.716a.75.75 0 0 1 1.059-.048L6.95 5.7a.75.75 0 0 1-1.012 1.107L3.717 4.775a.75.75 0 0 1-.048-1.06M20.332 3.716a.75.75 0 0 1-.048 1.06l-2.222 2.03A.75.75 0 1 1 17.05 5.7l2.222-2.032a.75.75 0 0 1 1.06.048M17.026 17.025a.75.75 0 0 1 1.06 0l2.223 2.222a.75.75 0 1 1-1.061 1.06l-2.222-2.222a.75.75 0 0 1 0-1.06M6.975 17.025a.75.75 0 0 1 0 1.06l-2.222 2.223a.75.75 0 0 1-1.06-1.06l2.222-2.223a.75.75 0 0 1 1.06 0" />
    </g>
  </svg>
)
export { LightModeFillIcon }

const DarkModeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10a10 10 0 0 1-3.321-.564A9 9 0 0 1 8 18c0-2.22.805-4.254 2.138-5.824A6.5 6.5 0 0 0 15.5 15a6.5 6.5 0 0 0 5.567-3.143c.24-.396.933-.32.933.143"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M2 12c0 4.359 2.789 8.066 6.679 9.435A9 9 0 0 1 8 18c0-2.221.805-4.254 2.138-5.824A6.47 6.47 0 0 1 9 8.5a6.5 6.5 0 0 1 3.143-5.567C12.54 2.693 12.463 2 12 2 6.477 2 2 6.477 2 12"
    />
  </svg>
)
export { DarkModeFillIcon }

const UploadFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M22 16v-1c0-2.829 0-4.242-.879-5.121S18.828 9 16 9H8C5.17 9 3.757 9 2.878 9.88 2 10.757 2 12.17 2 14.998V16c0 2.828 0 4.242.879 5.121C3.757 22 5.172 22 8 22h8c2.828 0 4.243 0 5.121-.879S22 18.828 22 16"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 15.75a.75.75 0 0 0 .75-.75V4.027l1.68 1.961a.75.75 0 1 0 1.14-.976l-3-3.5a.75.75 0 0 0-1.14 0l-3 3.5a.75.75 0 1 0 1.14.976l1.68-1.96V15c0 .414.336.75.75.75"
      clipRule="evenodd"
    />
  </svg>
)
export { UploadFillIcon }

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

const AudioFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12.053 2c2.148 0 3.83 0 5.143.179 1.345.183 2.405.564 3.237 1.407s1.21 1.916 1.39 3.277C22 8.193 22 9.896 22 12.07v5.297c0 .817 0 1.378-.143 1.87a3.52 3.52 0 0 1-1.847 2.188c-.457.22-1.004.307-1.801.434l-.13.02c-.284.046-.526.085-.727.105-.209.02-.422.027-.64-.016a2.1 2.1 0 0 1-1.561-1.35 2.2 2.2 0 0 1-.116-.639c-.012-.204-.012-.452-.012-.742v-4.173c0-.425 0-.791.097-1.105a2.1 2.1 0 0 1 1.528-1.43c.316-.073.677-.044 1.096-.01l.093.007.11.01c.783.062 1.32.104 1.775.275q.481.181.883.487v-1.174c0-2.24-.002-3.848-.165-5.073-.16-1.204-.463-1.93-.993-2.466S18.2 3.741 17.01 3.579c-1.21-.165-2.799-.166-5.011-.166s-3.801.001-5.01.166c-1.19.162-1.907.47-2.437 1.006S3.72 5.847 3.56 7.051c-.162 1.225-.164 2.833-.164 5.073v1.174c.267-.203.563-.368.883-.487.456-.17.992-.213 1.775-.276l.11-.009.093-.007c.42-.034.78-.063 1.096.01a2.1 2.1 0 0 1 1.528 1.43c.098.314.097.68.097 1.105v4.172c0 .291 0 .54-.012.743-.012.213-.04.427-.116.638a2.1 2.1 0 0 1-1.56 1.35 2.2 2.2 0 0 1-.641.017c-.201-.02-.443-.059-.727-.104l-.13-.02c-.797-.128-1.344-.215-1.801-.436a3.52 3.52 0 0 1-1.847-2.188C2 18.745 2 18.184 2 17.367V12.07c0-2.174 0-3.878.177-5.207.18-1.36.557-2.434 1.39-3.277S5.46 2.362 6.803 2.18C8.116 2 9.8 2 11.947 2z"
    />
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd" opacity={0.5}>
      <path d="M12 5.75a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75M15 7.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75M9 7.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V8A.75.75 0 0 1 9 7.25" />
    </g>
  </svg>
)
export { AudioFillIcon }

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

const ShareItemFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M1 13.529c0-4.667 0-7 1.45-8.45s3.783-1.45 8.45-1.45 7 0 8.45 1.45 1.45 3.783 1.45 8.45 0 7-1.45 8.45-3.783 1.45-8.45 1.45-7 0-8.45-1.45S1 18.196 1 13.53"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="m17.67 1.907 2.593 2.248c1.785 1.546 2.678 2.32 2.678 3.325 0 1.004-.893 1.778-2.678 3.325l-2.593 2.247c-.785.68-1.177 1.02-1.498.873-.322-.146-.322-.666-.322-1.704v-1.677c-2.65 0-5.477.988-7.2 2.7-.525.52-.788.781-.927.715-.14-.066-.107-.403-.042-1.076.648-6.721 5.061-8.468 8.169-8.468V2.74c0-1.04 0-1.558.322-1.705.321-.147.713.193 1.498.873"
    />
  </svg>
)
export { ShareItemFillIcon }

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

const EditFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M1 12c0-5.185 0-7.778 1.61-9.39C4.223 1 6.816 1 12 1s7.778 0 9.39 1.61C23 4.223 23 6.816 23 12s0 7.778-1.61 9.39C19.777 23 17.184 23 12 23s-7.778 0-9.39-1.61C1 19.777 1 17.184 1 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M13.926 14.302c.245-.191.467-.413.912-.858l5.54-5.54c.134-.134.073-.365-.106-.427a6.1 6.1 0 0 1-2.3-1.449 6.1 6.1 0 0 1-1.45-2.3c-.061-.179-.292-.24-.426-.106l-5.54 5.54c-.445.444-.667.667-.858.912a5 5 0 0 0-.577.932c-.133.28-.233.579-.431 1.175l-.257.77-.409 1.226-.382 1.148a.817.817 0 0 0 1.032 1.033l1.15-.383 1.224-.408.77-.257c.597-.199.895-.298 1.175-.432q.498-.236.933-.576M22.113 6.17a3.028 3.028 0 0 0-4.282-4.283l-.178.178a.73.73 0 0 0-.207.651c.027.15.077.37.168.633a4.9 4.9 0 0 0 1.174 1.863 4.9 4.9 0 0 0 1.862 1.174c.263.09.483.141.634.168.239.043.479-.035.65-.207z"
    />
  </svg>
)
export { EditFillIcon }

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

const DownloadFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M12 1.25a.75.75 0 0 0-.75.75v10.973l-1.68-1.961a.75.75 0 1 0-1.14.976l3 3.5a.75.75 0 0 0 1.14 0l3-3.5a.75.75 0 1 0-1.14-.976l-1.68 1.96V2a.75.75 0 0 0-.75-.75"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M22 16v-1c0-2.828 0-4.242-.879-5.12C20.242 9 18.828 9 16 9H8c-2.829 0-4.243 0-5.122.88C2 10.757 2 12.17 2 14.997V16c0 2.829 0 4.243.879 5.122C3.757 22 5.172 22 8 22h8c2.828 0 4.243 0 5.121-.878C22 20.242 22 18.829 22 16"
      opacity={0.5}
    />
  </svg>
)
export { DownloadFillIcon }

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

const CopyFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M6.6 11.397c0-2.726 0-4.089.843-4.936.844-.847 2.201-.847 4.917-.847h2.88c2.715 0 4.073 0 4.916.847.844.847.844 2.21.844 4.936v4.82c0 2.726 0 4.089-.844 4.936-.843.847-2.201.847-4.916.847h-2.88c-2.716 0-4.073 0-4.917-.847s-.843-2.21-.843-4.936z"
    />
    <path
      fill="currentColor"
      d="M4.172 3.172C3 4.343 3 6.229 3 10v2c0 3.771 0 5.657 1.172 6.828.617.618 1.433.91 2.62 1.048-.192-.84-.192-1.996-.192-3.66v-4.819c0-2.726 0-4.089.843-4.936.844-.847 2.201-.847 4.917-.847h2.88c1.652 0 2.8 0 3.638.19-.138-1.193-.43-2.012-1.05-2.632C16.657 2 14.771 2 11 2S5.343 2 4.172 3.172"
      opacity={0.5}
    />
  </svg>
)
export { CopyFillIcon }

const ActivityFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M15.1 12.094c-.185-.302-.366-.597-.542-.807-.187-.224-.515-.532-1.017-.512s-.804.353-.973.591c-.159.225-.315.532-.475.848l-1.988 3.92q-.11.22-.193.377l-.238-.351-.176-.266a11 11 0 0 0-.557-.788 2.2 2.2 0 0 0-.682-.59 2.2 2.2 0 0 0-.87-.24 11 11 0 0 0-.964-.026H5a.75.75 0 1 0 0 1.5h1.394c.407 0 .661 0 .856.019.18.017.254.044.301.07.047.025.111.07.225.211.123.152.265.363.49.702l.187.279c.188.283.373.56.553.759.192.213.522.497 1.01.468.486-.029.78-.35.947-.584.154-.219.305-.517.459-.82l1.987-3.918c.079-.155.144-.284.203-.395q.1.158.233.377l.654 1.068c.2.327.378.616.55.844.186.247.399.469.692.633s.593.23.901.26c.284.027.623.027 1.006.027H19a.75.75 0 0 0 0-1.5h-1.32c-.424 0-.69 0-.894-.02-.188-.019-.264-.049-.312-.076-.049-.027-.114-.076-.227-.227a11 11 0 0 1-.485-.752z"
    />
  </svg>
)
export { ActivityFillIcon }

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

const DetailsFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14v-4c0-3.771 0-5.657 1.172-6.828S6.239 2 10.03 2c.606 0 1.091 0 1.5.017q-.02.12-.02.244l-.01 2.834c0 1.097 0 2.067.105 2.848.114.847.375 1.694 1.067 2.386.69.69 1.538.952 2.385 1.066.781.105 1.751.105 2.848.105h4.052c.043.534.043 1.19.043 2.063V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M6 13.75a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5zM6 17.25a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5zM11.51 2.26l-.01 2.835c0 1.097 0 2.066.105 2.848.114.847.375 1.694 1.067 2.385.69.691 1.538.953 2.385 1.067.781.105 1.751.105 2.848.105h4.052q.02.232.028.5H22c0-.268 0-.402-.01-.56a5.3 5.3 0 0 0-.958-2.641c-.094-.128-.158-.204-.285-.357C19.954 7.494 18.91 6.312 18 5.5c-.81-.724-1.921-1.515-2.89-2.161-.832-.556-1.248-.834-1.819-1.04a6 6 0 0 0-.506-.154c-.384-.095-.758-.128-1.285-.14z"
    />
  </svg>
)
export { DetailsFillIcon }

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

const HeartFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M2 9.137c0 4.405 3.298 6.946 6.106 9.11q.44.337.856.664C10 19.729 11 20.5 12 20.5v-15C7.5.826 2 4.275 2 9.138"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="m14 7.5-2-2v15c1 0 2-.77 3.038-1.59q.417-.326.856-.663C18.702 16.083 22 13.542 22 9.137c0-4.462-4.631-7.734-8.871-4.63l1.931 1.931A.75.75 0 0 1 14 7.5"
    />
  </svg>
)
export { HeartFillIcon }

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

const MoreMenuFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"
    />
    <path
      fill="currentColor"
      d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"
      opacity={0.5}
    />
  </svg>
)
export { MoreMenuFillIcon }

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
      d="M12 17.75a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75ZM12 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
    />
    <path
      fill="currentColor"
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2c4.714 0 7.071 0 8.535 1.464C22 4.93 22 7.286 22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22Z"
      opacity={0.5}
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
      d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"
    />
    <path
      fill="currentColor"
      d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"
      opacity={0.5}
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

const LockFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 16c0-2.828 0-4.243.879-5.121C3.757 10 5.172 10 8 10h8c2.828 0 4.243 0 5.121.879C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M6.75 8a5.25 5.25 0 0 1 10.5 0v2.004c.567.005 1.064.018 1.5.05V8a6.75 6.75 0 0 0-13.5 0v2.055a24 24 0 0 1 1.5-.051z"
    />
  </svg>
)
export { LockFillIcon }

const UnlockFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 16c0-2.828 0-4.243.879-5.121C3.757 10 5.172 10 8 10h8c2.828 0 4.243 0 5.121.879C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M6.75 8a5.25 5.25 0 0 1 10.335-1.313.75.75 0 0 0 1.452-.374A6.75 6.75 0 0 0 5.25 8v2.055a24 24 0 0 1 1.5-.051z"
    />
  </svg>
)
export { UnlockFillIcon }

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
      strokeWidth={1.5}
      d="M2 17.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C3.098 15 3.565 15 4.5 15s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549C7 16.098 7 16.565 7 17.5s0 1.402-.201 1.75a1.5 1.5 0 0 1-.549.549C5.902 20 5.435 20 4.5 20s-1.402 0-1.75-.201a1.5 1.5 0 0 1-.549-.549C2 18.902 2 18.435 2 17.5Z"
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M9.5 17.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C10.598 15 11.065 15 12 15s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75s0 1.402-.201 1.75a1.5 1.5 0 0 1-.549.549C13.402 20 12.935 20 12 20s-1.402 0-1.75-.201a1.5 1.5 0 0 1-.549-.549c-.201-.348-.201-.815-.201-1.75Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M17 17.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C18.098 15 18.565 15 19.5 15s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75s0 1.402-.201 1.75a1.5 1.5 0 0 1-.549.549c-.348.201-.815.201-1.75.201s-1.402 0-1.75-.201a1.5 1.5 0 0 1-.549-.549C17 18.902 17 18.435 17 17.5Z"
      opacity={0.7}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M4.5 15V9c0-2.357 0-3.536.732-4.268S7.143 4 9.5 4h5c2.357 0 3.535 0 4.268.732S19.5 6.643 19.5 9v3m0 0 2-2m-2 2-2-2"
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

// const RemoveIcon = (props: SVGProps<SVGSVGElement>) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width="1em"
//     height="1em"
//     fill="none"
//     viewBox="0 0 24 24"
//     {...props}
//   >
//     <circle
//       cx={12}
//       cy={12}
//       r={10}
//       stroke="currentColor"
//       strokeWidth={1.5}
//       opacity={0.5}
//     />
//     <path
//       stroke="currentColor"
//       strokeLinecap="round"
//       strokeWidth={1.5}
//       d="m14.5 9.5-5 5m0-5 5 5"
//     />
//   </svg>
// )
// export { RemoveIcon }

const RenameFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3.172 18.828C4.343 20 6.229 20 10 20l5.75-.006c2.636-.027 4.104-.191 5.078-1.166C22 17.658 22 15.771 22 12s0-5.657-1.172-6.828c-.974-.975-2.454-1.144-5.09-1.172H10C6.229 4 4.343 4 3.172 5.172S2 8.229 2 12s0 5.657 1.172 6.828"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M15 1.25a.75.75 0 0 1 .75.75v20a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M6.818 7.787c.3-.037.666-.037 1.066-.037h2.232c.4 0 .766 0 1.066.037.329.041.68.137.98.405q.078.068.146.146c.268.3.364.651.405.98.037.3.037.666.037 1.066v.041a.75.75 0 0 1-1.5 0c0-.455-.001-.726-.026-.922-.024-.195-.228-.227-.228-.227-.195-.025-.466-.026-.921-.026H9.75v5.5H11a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1 0-1.5h1.25v-5.5h-.325c-.455 0-.726.001-.922.026 0 0-.203.032-.227.227-.025.196-.026.467-.026.922a.75.75 0 0 1-1.5 0v-.041c0-.4 0-.766.037-1.066.041-.329.137-.68.405-.98q.069-.078.146-.146c.3-.268.651-.364.98-.405"
    />
  </svg>
)
export { RenameFillIcon }

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
      strokeWidth={1.5}
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 7v10l-3-3.437M14 17V7l3 3.438"
    />
  </svg>
)
export { ExpandCollapsedIcon }

const LoadMoreFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M20 2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2"
    />
    <path
      fill="currentColor"
      d="M12 7h-1c-1.886 0-2.828 0-3.414.586S7 9.114 7 11v2c0 1.886 0 2.828.586 3.414S9.114 17 11 17h2c1.886 0 2.828 0 3.414-.586S17 14.886 17 13v-1h-1c-1.886 0-2.828 0-3.414-.586S12 9.886 12 8z"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="M7 12v1c0 1.886 0 2.828.586 3.414S9.114 17 11 17h1v1c0 1.886 0 2.828-.586 3.414S9.886 22 8 22H6c-1.886 0-2.828 0-3.414-.586S2 19.886 2 18v-2c0-1.886 0-2.828.586-3.414S4.114 12 6 12z"
      opacity={0.4}
    />
  </svg>
)
export { LoadMoreFillIcon }

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

// Generate — branching tree: single root expanding into many outputs

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

const ResumeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M21 12c0-1.875-1.612-2.97-4.837-5.163a46 46 0 0 0-2.585-1.65 45 45 0 0 0-2.352-1.27C8.009 2.287 6.4 1.471 4.957 2.374c-1.442.903-1.574 2.792-1.836 6.57A45 45 0 0 0 3 12z"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M13.578 18.813a46 46 0 0 0 2.585-1.65C19.388 14.971 21 13.875 21 12H3c0 .94.047 1.987.121 3.055.262 3.78.393 5.669 1.836 6.571s3.052.087 6.269-1.543c.834-.423 1.64-.854 2.352-1.27"
      opacity={0.5}
    />
  </svg>
)
export { ResumeFillIcon }

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

const PauseFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
export { PauseFillIcon }

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

const BreadcrumbSeparatorIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="m9 5 6 7-6 7"
    />
  </svg>
)
export { BreadcrumbSeparatorIcon }

const CollectionFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="m20.312 12.647.517-1.932c.604-2.255.907-3.382.68-4.358a4 4 0 0 0-1.162-2.011c-.731-.685-1.859-.987-4.114-1.591-2.255-.605-3.383-.907-4.358-.68a4 4 0 0 0-2.011 1.162c-.587.626-.893 1.543-1.348 3.209l-.244.905-.517 1.932c-.605 2.255-.907 3.382-.68 4.358a4 4 0 0 0 1.162 2.011c.731.685 1.859.987 4.114 1.592 2.032.544 3.149.843 4.064.73q.15-.019.294-.052a4 4 0 0 0 2.011-1.16c.685-.732.987-1.86 1.592-4.115"
    />
    <path
      fill="currentColor"
      d="M16.415 17.975a4 4 0 0 1-1.068 1.677c-.731.685-1.859.987-4.114 1.591s-3.383.907-4.358.679a4 4 0 0 1-2.011-1.161c-.685-.731-.988-1.859-1.592-4.114l-.517-1.932c-.605-2.255-.907-3.383-.68-4.358a4 4 0 0 1 1.162-2.011c.731-.685 1.859-.987 4.114-1.592q.638-.172 1.165-.309l-.244.906-.517 1.932c-.605 2.255-.907 3.382-.68 4.358a4 4 0 0 0 1.162 2.011c.731.685 1.859.987 4.114 1.592 2.032.544 3.149.843 4.064.73"
      opacity={0.5}
    />
  </svg>
)
export { CollectionFillIcon }

const CollectionLineIcon = (props: SVGProps<SVGSVGElement>) => (
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
export { CollectionLineIcon }

const ViewIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3.275 15.296C2.425 14.192 2 13.639 2 12c0-1.64.425-2.191 1.275-3.296C4.972 6.5 7.818 4 12 4s7.028 2.5 8.725 4.704C21.575 9.81 22 10.361 22 12c0 1.64-.425 2.191-1.275 3.296C19.028 17.5 16.182 20 12 20s-7.028-2.5-8.725-4.704Z"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
)
export { ViewIcon }

const ViewFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0 1.64.425 2.191 1.275 3.296C4.972 17.5 7.818 20 12 20s7.028-2.5 8.725-4.704C21.575 14.192 22 13.639 22 12c0-1.64-.425-2.191-1.275-3.296C19.028 6.5 16.182 4 12 4S4.972 6.5 3.275 8.704C2.425 9.81 2 10.361 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.25 12a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0m1.5 0a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0"
      clipRule="evenodd"
    />
  </svg>
)
export { ViewFillIcon }

const AnonymousFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M21 16.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M1.25 10A.75.75 0 0 1 2 9.25h20a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="m4.188 9.25.426-1.705c.545-2.183.818-3.274 1.632-3.91C7.06 3 8.185 3 10.435 3h3.13c2.25 0 3.375 0 4.189.635.814.636 1.086 1.727 1.632 3.91l.427 1.705z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M10 16.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0"
    />
    <path
      fill="currentColor"
      d="M9.884 17.397a3.5 3.5 0 0 0 .025-1.69l.414-.207a3.75 3.75 0 0 1 3.354 0l.413.206a3.5 3.5 0 0 0 .026 1.69l-1.11-.555a2.25 2.25 0 0 0-2.012 0z"
      opacity={0.5}
    />
  </svg>
)
export { AnonymousFillIcon }

const GroupIcon = (props: SVGProps<SVGSVGElement>) => (
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
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M18 9c1.657 0 3-1.12 3-2.5S19.657 4 18 4M6 9C4.343 9 3 7.88 3 6.5S4.343 4 6 4"
      opacity={0.5}
    />
    <ellipse
      cx={12}
      cy={17}
      stroke="currentColor"
      strokeWidth={1.5}
      rx={6}
      ry={4}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20 19c1.754-.385 3-1.359 3-2.5s-1.246-2.115-3-2.5M4 19c-1.754-.385-3-1.359-3-2.5s1.246-2.115 3-2.5"
      opacity={0.5}
    />
  </svg>
)
export { GroupIcon }

const GroupFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx={15} cy={6} r={3} fill="currentColor" opacity={0.5} />
    <ellipse cx={16} cy={17} fill="currentColor" opacity={0.5} rx={5} ry={3} />
    <circle cx={9.001} cy={6} r={4} fill="currentColor" />
    <ellipse cx={9.001} cy={17.001} fill="currentColor" rx={7} ry={4} />
  </svg>
)
export { GroupFillIcon }

const LinkIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M8 18c-2.828 0-4.243 0-5.121-.879C2 16.243 2 14.828 2 12s0-4.243.879-5.121C3.757 6 5.172 6 8 6s4.243 0 5.121.879C14 7.757 14 9.172 14 12"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 12c0 2.828 0 4.243.879 5.121C11.757 18 13.172 18 16 18s4.243 0 5.121-.879C22 16.243 22 14.828 22 12s0-4.243-.879-5.121C20.243 6 18.828 6 16 6"
      opacity={0.5}
    />
  </svg>
)
export { LinkIcon }

const SendInvitationIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M17 2.127c1.625.16 2.72.521 3.535 1.337C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.281 2.648 5.374 2.287 7 2.127"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 10V2m0 0 3 3m-3-3L9 5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M2 13h3.16c.905 0 1.358 0 1.756.183s.692.527 1.281 1.214l.606.706c.589.687.883 1.031 1.281 1.214s.85.183 1.756.183h.32c.905 0 1.358 0 1.756-.183s.692-.527 1.281-1.214l.606-.706c.589-.687.883-1.031 1.281-1.214S17.934 13 18.84 13H22"
      opacity={0.5}
    />
  </svg>
)
export { SendInvitationIcon }

const FolderOpenIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4 11.5V5.712c0-.662 0-.993.055-1.268C4.3 3.23 5.312 2.28 6.607 2.052 6.9 2 7.254 2 7.96 2c.31 0 .464 0 .612.013.641.056 1.25.292 1.745.677a7 7 0 0 1 .443.397l.44.413c.653.612.979.918 1.37 1.122q.323.168.678.263c.43.115.892.115 1.815.115h.299c2.106 0 3.158 0 3.843.577q.095.08.18.168C20 6.387 20 7.375 20 9.348V11.5"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M10 17h4"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeWidth={1.5}
      d="M3.477 17.484C3 14.768 2.76 13.41 3.339 12.433q.223-.376.54-.67C4.704 11 6.038 11 8.705 11h6.59c2.667 0 4 0 4.826.763q.316.294.54.67c.578.977.34 2.335-.138 5.05-.343 1.956-.515 2.934-1.11 3.582a3 3 0 0 1-.515.445c-.723.49-1.683.49-3.603.49h-6.59c-1.92 0-2.88 0-3.603-.49a3 3 0 0 1-.515-.445c-.595-.648-.767-1.626-1.11-3.581Z"
    />
  </svg>
)
export { FolderOpenIcon }

const DropdownIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="m8.303 12.404 3.327 3.431c.213.22.527.22.74 0l6.43-6.63C19.201 8.79 18.958 8 18.43 8h-5.723z"
    />
    <path
      fill="currentColor"
      d="M11.293 8H5.57c-.528 0-.771.79-.37 1.205l2.406 2.481z"
      opacity={0.5}
    />
  </svg>
)
export { DropdownIcon }

const RemoveIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="m7.757 7.757 8.486 8.486"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m7.757 16.243 8.486-8.486"
    />
  </svg>
)
export { RemoveIcon }

const MinusFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M15 12.75a.75.75 0 0 0 0-1.5H9a.75.75 0 0 0 0 1.5z"
    />
  </svg>
)
export { MinusFillIcon }

const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      cx={11.5}
      cy={11.5}
      r={9.5}
      stroke="currentColor"
      strokeWidth={1.5}
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M18.5 18.5 22 22"
    />
  </svg>
)
export { SearchIcon }

const SearchFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M20.313 11.157a9.157 9.157 0 1 1-18.313 0 9.157 9.157 0 0 1 18.313 0"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="m17.1 18.122 3.666 3.666a.723.723 0 0 0 1.023-1.022L18.122 17.1a9 9 0 0 1-1.022 1.022"
    />
  </svg>
)
export { SearchFillIcon }

const FuzzySearchIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4 9q2.5-3 5 0t5 0 5 0"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M4 15q2.5-3 5 0t5 0 5 0"
      opacity={0.5}
    />
  </svg>
)
export { FuzzySearchIcon }

const SemanticSearchIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10.5 10.5 7.5 7.5M13.5 10.5 16.5 7.5M12 14v4"
      opacity={0.5}
    />
    <circle cx={12} cy={12} r={2} fill="currentColor" />
    <circle cx={6} cy={6} r={1.75} stroke="currentColor" strokeWidth={1.5} />
    <circle cx={18} cy={6} r={1.75} stroke="currentColor" strokeWidth={1.5} />
    <circle cx={12} cy={20} r={1.75} stroke="currentColor" strokeWidth={1.5} />
  </svg>
)
export { SemanticSearchIcon }

const ArrowLeftFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M10.03 6.47a.75.75 0 0 0-1.06 0l-5 5a.75.75 0 0 0 0 1.06l5 5a.75.75 0 1 0 1.06-1.06L5.56 12l4.47-4.47a.75.75 0 0 0 0-1.06"
      clipRule="evenodd"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M6.31 11.25h8.19c.953 0 2.367.28 3.563 1.141 1.235.89 2.187 2.365 2.187 4.609a.75.75 0 0 1-1.5 0c0-1.756-.715-2.78-1.563-3.391-.887-.639-1.974-.859-2.687-.859H6.31L5.56 12zM3.807 11.713" />
    </g>
  </svg>
)
export { ArrowLeftFillIcon }

const CalendarIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-3.771 0-5.657 1.172-6.828S6.229 4 10 4h4c3.771 0 5.657 0 6.828 1.172S22 8.229 22 12v2c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M7 4V2.5M17 4V2.5M2 9h20"
      opacity={0.5}
    />
  </svg>
)
export { CalendarIcon }

const SortByTextIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M13 7H3M10 12H3M8 17H3"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M11.316 16.692a.75.75 0 1 0 1.368.616zM16.5 7l.684-.308a.75.75 0 0 0-1.368 0zm3.816 10.308a.75.75 0 1 0 1.368-.616zm-.952-3.944.684-.308zm-5.728-.75a.75.75 0 0 0 0 1.5zm-.952 4.694 4.5-10-1.368-.616-4.5 10zm9-.616-1.636-3.636-1.368.615 1.636 3.637zm-1.636-3.636-2.864-6.364-1.368.616 2.864 6.363zm-.684-.442h-5.728v1.5h5.728z"
    />
  </svg>
)
export { SortByTextIcon }

const SortByNumberIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M13 7H3M10 12H3M8 17H3"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16 7l-2.5 9M20.5 7L18 16"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M22 10h-9M21 13.5h-9"
      opacity={0.5}
    />
  </svg>
)
export { SortByNumberIcon }

const SortListIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4 17h7M4 12h7M4 7h7"
      opacity={0.5}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 4v16m0-16-3 4m3-4 3 4m-3 12 3-4m-3 4-3-4"
    />
  </svg>
)
export { SortListIcon }

const SortDescIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4 8h9"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6 13h7"
      opacity={0.7}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 18h5"
      opacity={0.4}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20V4l3 4"
    />
  </svg>
)
export { SortDescIcon }

const SortAscIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4 16h9"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M6 11h7"
      opacity={0.7}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M8 6h5"
      opacity={0.3}
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 4v16l3-4"
    />
  </svg>
)
export { SortAscIcon }

const SortByDateTimeIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10 7H2M8 12H2M10 17H2"
      opacity={0.5}
    />
    <circle cx={17} cy={12} r={5} stroke="currentColor" strokeWidth={1.5} />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 10v1.846L18 13"
    />
  </svg>
)
export { SortByDateTimeIcon }

const ColorModeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M7.75 19a.75.75 0 0 1-.75.75H5a.75.75 0 0 1 0-1.5h2a.75.75 0 0 1 .75.75"
    />
    <path
      fill="currentColor"
      d="M10 18V6c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.093-1.093C8.1 2 7.4 2 6 2s-2.1 0-2.635.272a2.5 2.5 0 0 0-1.093 1.093C2 3.9 2 4.6 2 6v12c0 1.4 0 2.1.272 2.635a2.5 2.5 0 0 0 1.093 1.092C3.9 22 4.6 22 6 22s2.1 0 2.635-.273a2.5 2.5 0 0 0 1.093-1.092C10 20.1 10 19.4 10 18"
      opacity={0.4}
    />
    <g fill="currentColor" opacity={0.7}>
      <path d="M10 8.243V18c0 .919 0 1.536-.077 2.003l3.299-3.299 5.838-6.09c.973-1.003 1.46-1.505 1.636-2.08a2.5 2.5 0 0 0-.011-1.503C20.5 6.458 20 5.958 19 4.959c-.9-.886-1.352-1.33-1.88-1.514a2.5 2.5 0 0 0-1.353-.085c-.547.118-1.049.502-2.053 1.27L13 5.243zM8.003 21.923H8v.003z" />
    </g>
    <path
      fill="currentColor"
      d="M15.814 14H17.9c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.093 1.092c.272.535.272 1.235.272 2.635s0 2.1-.272 2.635a2.5 2.5 0 0 1-1.093 1.092C20 22 19.3 22 17.9 22H6c.917 0 1.534 0 2-.077v.003l.003-.003c.245-.04.448-.102.632-.195a2.5 2.5 0 0 0 1.093-1.093c.093-.184.155-.387.195-.632l3.299-3.299z"
    />
  </svg>
)
export { ColorModeFillIcon }

const StorageFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 10c4.418 0 8-1.79 8-4s-3.582-4-8-4-8 1.79-8 4 3.582 4 8 4"
    />
    <path
      fill="currentColor"
      d="M4 12v6c0 2.21 3.582 4 8 4s8-1.79 8-4v-6c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M4 6v6c0 2.21 3.582 4 8 4s8-1.79 8-4V6c0 2.21-3.582 4-8 4S4 8.21 4 6"
      opacity={0.7}
    />
  </svg>
)
export { StorageFillIcon }

const TrashFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3.034 8.89c-.48-3.204-.721-4.805.176-5.848C4.108 2 5.728 2 8.967 2h6.066c3.24 0 4.86 0 5.757 1.042s.657 2.644.177 5.848l-1.2 8c-.366 2.438-.549 3.656-1.393 4.383S16.298 22 13.833 22h-3.666c-2.465 0-3.697 0-4.541-.727s-1.027-1.945-1.392-4.383z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="m3.517 12.115-.29-1.933 1.845-2.05L3.689 6.75h-.96a15 15 0 0 1-.122-1.5h18.787c-.01.437-.054.933-.123 1.5h-.96l-1.383 1.382 1.845 2.05-.29 1.933-1.6 1.707 1.169 1.169-.277 1.845-1.919-1.92-1.877 2.003 1.332 1.331h2.245c-.098.59-.195 1.083-.314 1.5H4.758c-.119-.417-.216-.91-.314-1.5h2.245l1.332-1.331-1.877-2.002-1.919 1.918-.276-1.844 1.168-1.17zm2.56-5.099L5.81 6.75h.505zm1.062 1.062L8.334 6.75h1.355L10.94 8 9 9.94zm4.86-1.139-.188-.189h.378zM13.062 8l1.25-1.25h1.355l1.195 1.328L15 9.94zm4.862-.984-.239-.266h.505zM16.061 11l1.805-1.805 1.616 1.795-1.66 1.77zM15 12.06l1.795 1.795-1.877 2.002L13.061 14zm-3 3 1.892 1.892-1.217 1.298h-1.35l-1.217-1.298zm3.19 3.19h-.459l.222-.236zm-6.143-.236.222.236H8.81zM10.94 14l-1.857 1.857-1.877-2.001L9 12.06zm-3-3-1.76 1.76-1.66-1.77 1.615-1.795zM12 12.94 10.062 11 12 9.06 13.94 11z"
      clipRule="evenodd"
    />
  </svg>
)
export { TrashFillIcon }

const HomeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12.204c0-2.289 0-3.433.52-4.381.518-.949 1.467-1.537 3.364-2.715l2-1.241C9.889 2.622 10.892 2 12 2s2.11.622 4.116 1.867l2 1.241c1.897 1.178 2.846 1.766 3.365 2.715S22 9.915 22 12.203v1.522c0 3.9 0 5.851-1.172 7.063S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.212S2 17.626 2 13.725z"
    />
    <path
      opacity={0.5}
      fill="currentColor"
      d="M9 17.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5z"
    />
  </svg>
)
export { HomeFillIcon }

const MusicFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12.053 2c2.148 0 3.83 0 5.143.179 1.345.183 2.405.564 3.237 1.407s1.21 1.916 1.39 3.277C22 8.193 22 9.896 22 12.07v5.297c0 .817 0 1.378-.143 1.87a3.52 3.52 0 0 1-1.847 2.188c-.457.22-1.004.307-1.801.434l-.13.02c-.284.046-.526.085-.727.105-.209.02-.422.027-.64-.016a2.1 2.1 0 0 1-1.561-1.35 2.2 2.2 0 0 1-.116-.639c-.012-.204-.012-.452-.012-.742v-4.173c0-.425 0-.791.097-1.105a2.1 2.1 0 0 1 1.528-1.43c.316-.073.677-.044 1.096-.01l.093.007.11.01c.783.062 1.32.104 1.775.275q.481.181.883.487v-1.174c0-2.24-.002-3.848-.165-5.073-.16-1.204-.463-1.93-.993-2.466S18.2 3.741 17.01 3.579c-1.21-.165-2.799-.166-5.011-.166s-3.801.001-5.01.166c-1.19.162-1.907.47-2.437 1.006S3.72 5.847 3.56 7.051c-.162 1.225-.164 2.833-.164 5.073v1.174c.267-.203.563-.368.883-.487.456-.17.992-.213 1.775-.276l.11-.009.093-.007c.42-.034.78-.063 1.096.01a2.1 2.1 0 0 1 1.528 1.43c.098.314.097.68.097 1.105v4.172c0 .291 0 .54-.012.743-.012.213-.04.427-.116.638a2.1 2.1 0 0 1-1.56 1.35 2.2 2.2 0 0 1-.641.017c-.201-.02-.443-.059-.727-.104l-.13-.02c-.797-.128-1.344-.215-1.801-.436a3.52 3.52 0 0 1-1.847-2.188C2 18.745 2 18.184 2 17.367V12.07c0-2.174 0-3.878.177-5.207.18-1.36.557-2.434 1.39-3.277S5.46 2.362 6.803 2.18C8.116 2 9.8 2 11.947 2z"
    />
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd" opacity={0.5}>
      <path d="M12 5.75a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75M15 7.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75M9 7.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V8A.75.75 0 0 1 9 7.25" />
    </g>
  </svg>
)
export { MusicFillIcon }

const FolderFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 6.95c0-.883 0-1.324.07-1.692A4 4 0 0 1 5.257 2.07C5.626 2 6.068 2 6.95 2c.386 0 .58 0 .766.017a4 4 0 0 1 2.18.904c.144.119.28.255.554.529L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c2.632 0 3.949 0 4.804.77q.119.105.224.224c.77.855.77 2.172.77 4.804V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14z"
    />
    <path
      opacity={0.5}
      fill="currentColor"
      d="M20 6.238c-.001-.298-.005-.475-.026-.63a3 3 0 0 0-2.582-2.582C17.197 3 16.965 3 16.5 3H9.988c.116.104.247.234.462.45L11 4c.816.816 1.224 1.224 1.712 1.495a4 4 0 0 0 .848.352C14.098 6 14.675 6 15.828 6h.374c1.78 0 2.957 0 3.798.238"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.25 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75"
      clipRule="evenodd"
    />
  </svg>
)
export { FolderFillIcon }

const VideosFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M14.995 7.542h-5.99c-3.037 0-4.556 0-5.409.987s-.652 2.511-.25 5.56l.38 2.892c.315 2.391.472 3.587 1.28 4.303.807.716 1.998.716 4.38.716h5.228c2.382 0 3.573 0 4.38-.716.808-.716.965-1.912 1.28-4.303l.38-2.892c.402-3.049.603-4.573-.25-5.56s-2.372-.987-5.41-.987m-4.347 4.578-.014.008h-.002c-.014.01-.07.044-.125.296-.064.29-.092.703-.136 1.364-.023.35-.037.687-.037.983s.014.632.037.983c.043.661.072 1.073.136 1.363.055.253.11.287.125.296h.002c.012.01.014.008.014.008.011.001.058.001.163-.032.234-.075.548-.24 1.084-.53.257-.138.498-.276.708-.406.239-.148.504-.33.779-.529.533-.385.854-.62 1.056-.829.17-.175.179-.254.179-.324s-.01-.149-.18-.325c-.2-.207-.522-.443-1.055-.828-.275-.199-.54-.381-.78-.53-.209-.13-.45-.268-.707-.406-.536-.289-.85-.455-1.084-.53a.5.5 0 0 0-.163-.032"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M6.88 4.723c-1.252 0-2.278.84-2.62 1.953l-.021.07c.358-.12.731-.199 1.109-.253.972-.138 2.2-.138 3.628-.138h6.203c1.427 0 2.656 0 3.629.138.377.054.75.133 1.108.253l-.02-.07c-.343-1.114-1.369-1.953-2.62-1.953z"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="M8.859 2h6.282c.21 0 .37 0 .51.015a2.62 2.62 0 0 1 2.16 1.672H6.19a2.62 2.62 0 0 1 2.16-1.672C8.49 2 8.65 2 8.858 2"
      opacity={0.4}
    />
  </svg>
)
export { VideosFillIcon }

const ImagesFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M17.29 11.969a1.33 1.33 0 0 1-1.322 1.337 1.33 1.33 0 0 1-1.323-1.337 1.33 1.33 0 0 1 1.323-1.338c.73 0 1.323.599 1.323 1.338"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.132 7.408c-.849-.12-1.942-.12-3.305-.12H9.173c-1.363 0-2.456 0-3.305.12-.877.125-1.608.393-2.152 1.02-.543.628-.71 1.397-.716 2.293-.006.866.139 1.962.319 3.329l.365 2.771c.141 1.068.255 1.933.432 2.61.185.704.457 1.289.968 1.741s1.12.648 1.834.74C7.605 22 8.468 22 9.533 22h4.934c1.065 0 1.928 0 2.615-.088.715-.092 1.323-.288 1.834-.74s.783-1.037.968-1.741c.177-.677.291-1.542.432-2.61l.365-2.771c.18-1.367.325-2.463.319-3.33-.007-.895-.172-1.664-.716-2.291-.544-.628-1.275-.896-2.152-1.021M6.052 8.732c-.726.104-1.094.292-1.34.578-.248.285-.384.678-.39 1.42-.005.762.126 1.764.315 3.195l.05.38.371-.273c.96-.702 2.376-.668 3.288.095l3.384 2.833c.32.268.871.318 1.269.084l.235-.138c1.125-.662 2.634-.592 3.672.19l1.832 1.38c.09-.496.171-1.105.273-1.876l.352-2.675c.189-1.43.32-2.433.314-3.195-.005-.742-.141-1.135-.388-1.42-.247-.286-.615-.474-1.342-.578-.745-.106-1.745-.107-3.172-.107h-5.55c-1.427 0-2.427.001-3.172.107"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M6.88 4.5c-1.252 0-2.278.84-2.62 1.954l-.021.07c.358-.12.731-.2 1.109-.253.972-.139 2.2-.139 3.628-.139h6.203c1.427 0 2.656 0 3.629.139.377.053.75.132 1.108.253l-.02-.07C19.553 5.34 18.527 4.5 17.276 4.5z"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="M8.859 2h6.282c.21 0 .37 0 .51.015a2.62 2.62 0 0 1 2.16 1.672H6.19a2.62 2.62 0 0 1 2.16-1.672C8.49 2 8.65 2 8.858 2"
      opacity={0.4}
    />
  </svg>
)
export { ImagesFillIcon }

const VideoFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M3.464 3.464C2 4.93 2 7.286 2 12s0 7.071 1.464 8.535C4.93 22 7.286 22 12 22s7.071 0 8.535-1.465C22 19.072 22 16.714 22 12s0-7.071-1.465-8.536C19.072 2 16.714 2 12 2S4.929 2 3.464 3.464"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M14 12c0-.528-.53-.884-1.589-1.596-1.073-.721-1.61-1.082-2.01-.817C10 9.852 10 10.567 10 12s0 2.148.4 2.413.938-.096 2.011-.817C13.471 12.884 14 12.528 14 12M11.25 2c-1.366.001-2.519.01-3.5.068V6.25h3.5zM6.25 2.221c-1.223.195-2.101.56-2.785 1.243-.685.684-1.05 1.563-1.243 2.786H6.25zM21.778 6.25c-.194-1.223-.558-2.102-1.242-2.786s-1.563-1.048-2.786-1.243V6.25zM12.75 2c1.366.001 2.519.01 3.5.068V6.25h-3.5zM21.778 17.75H17.75v4.028c1.223-.194 2.102-.559 2.786-1.243s1.048-1.562 1.242-2.785M16.25 17.75v4.181c-.981.058-2.134.067-3.5.069v-4.25zM11.25 22v-4.25h-3.5v4.181c.981.058 2.134.067 3.5.069M6.25 17.75v4.028c-1.223-.194-2.101-.559-2.785-1.243s-1.05-1.562-1.243-2.785z"
    />
  </svg>
)
export { VideoFillIcon }

const ImageFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="currentColor" d="M18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.943 1.25h.114c2.309 0 4.118 0 5.53.19 1.444.194 2.584.6 3.479 1.494.895.895 1.3 2.035 1.494 3.48.19 1.411.19 3.22.19 5.529v.088c0 1.909 0 3.471-.104 4.743-.104 1.28-.317 2.347-.795 3.235q-.314.586-.785 1.057c-.895.895-2.035 1.3-3.48 1.494-1.411.19-3.22.19-5.529.19h-.114c-2.309 0-4.118 0-5.53-.19-1.444-.194-2.584-.6-3.479-1.494-.793-.793-1.203-1.78-1.42-3.006-.215-1.203-.254-2.7-.262-4.558Q1.25 12.792 1.25 12v-.058c0-2.309 0-4.118.19-5.53.194-1.444.6-2.584 1.494-3.479.895-.895 2.035-1.3 3.48-1.494 1.411-.19 3.22-.19 5.529-.19m-5.33 1.676c-1.278.172-2.049.5-2.618 1.069-.57.57-.897 1.34-1.069 2.619-.174 1.3-.176 3.008-.176 5.386q0 .793.002 1.495c.008 1.874.05 3.246.238 4.303.184 1.035.498 1.7 1.005 2.207.57.57 1.34.897 2.619 1.069 1.3.174 3.008.176 5.386.176s4.086-.002 5.386-.176c1.279-.172 2.05-.5 2.62-1.069.21-.21.381-.442.524-.707.332-.616.523-1.44.621-2.645s.099-2.707.099-4.653c0-2.378-.002-4.086-.176-5.386-.172-1.279-.5-2.05-1.069-2.62-.57-.569-1.34-.896-2.619-1.068-1.3-.174-3.008-.176-5.386-.176s-4.086.002-5.386.176"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="m20.607 19.146-2.83-2.547a3 3 0 0 0-3.733-.225l-.298.21a2 2 0 0 1-2.564-.222l-4.29-4.29a2.3 2.3 0 0 0-3.14-.104l-1.002.876.002.65c.008 1.875.05 3.247.238 4.304.184 1.035.498 1.7 1.005 2.207.57.57 1.34.897 2.619 1.069 1.3.174 3.008.176 5.386.176s4.087-.002 5.386-.176c1.279-.172 2.05-.5 2.62-1.069a3 3 0 0 0 .6-.859"
      opacity={0.4}
    />
  </svg>
)
export { ImageFillIcon }

const FavoritesFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 9.137C2 14 6.02 16.591 8.962 18.911 10 19.729 11 20.5 12 20.5s2-.77 3.038-1.59C17.981 16.592 22 14 22 9.138S16.5.825 12 5.501C7.5.825 2 4.274 2 9.137"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M16.5 13.287c-2.475-2.716-5.5-.712-5.5 2.112 0 2.56 1.814 4.035 3.358 5.292l.044.036.427.35c.571.475 1.121.923 1.671.923s1.1-.448 1.671-.923C19.789 19.73 22 18.224 22 15.399c0-.927-.326-1.767-.853-2.38-1.075-1.251-2.985-1.556-4.647.268"
    />
  </svg>
)
export { FavoritesFillIcon }

const ArchiveFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4.172 3.172C3 4.343 3 6.229 3 10v4c0 3.771 0 5.657 1.172 6.828S7.229 22 11 22h2c3.771 0 5.657 0 6.828-1.172S21 17.771 21 14v-4c0-3.771 0-5.657-1.172-6.828S16.771 2 13 2h-1l-2.5.003c-2.794.02-4.324.164-5.328 1.169"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M13.5 8H12v1c0 .471 0 .707.146.854.147.146.383.146.854.146h.5c.471 0 .707 0 .854-.146.146-.147.146-.383.146-.854s0-.707-.146-.854C14.207 8 13.97 8 13.5 8M9.646 6.146C9.5 6.293 9.5 6.53 9.5 7s0 .707.146.854C9.793 8 10.03 8 10.5 8H12V6h-1.5c-.471 0-.707 0-.854.146M13.5 4H12v2h1.5c.471 0 .707 0 .854-.146.146-.147.146-.383.146-.854s0-.707-.146-.854C14.207 4 13.97 4 13.5 4M12 4V2l-2.5.003V3c0 .471 0 .707.146.854C9.793 4 10.03 4 10.5 4zM9.5 13v-.125c0-.483.392-.875.875-.875h3.25c.483 0 .875.392.875.875V13a2.5 2.5 0 0 1-5 0"
    />
  </svg>
)
export { ArchiveFillIcon }

const FileFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14v-4c0-3.771 0-5.657 1.172-6.828S6.239 2 10.03 2c.606 0 1.091 0 1.5.017q-.02.12-.02.244l-.01 2.834c0 1.097 0 2.067.105 2.848.114.847.375 1.694 1.067 2.386.69.69 1.538.952 2.385 1.066.781.105 1.751.105 2.848.105h4.052c.043.534.043 1.19.043 2.063V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="m11.51 2.26-.01 2.835c0 1.097 0 2.066.105 2.848.114.847.375 1.694 1.067 2.385.69.691 1.538.953 2.385 1.067.781.105 1.751.105 2.848.105h4.052q.02.232.028.5H22c0-.268 0-.402-.01-.56a5.3 5.3 0 0 0-.958-2.641c-.094-.128-.158-.204-.285-.357C19.954 7.494 18.91 6.312 18 5.5c-.81-.724-1.921-1.515-2.89-2.161-.832-.556-1.248-.834-1.819-1.04a6 6 0 0 0-.506-.154c-.384-.095-.758-.128-1.285-.14z"
    />
  </svg>
)
export { FileFillIcon }

const PinFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M19.152 7.79 16.21 4.848c-2.028-2.027-3.042-3.041-4.149-2.818-1.107.224-1.648 1.552-2.73 4.207l-1.014 2.49c-.299.733-.448 1.1-.705 1.379a2 2 0 0 1-.287.26c-.304.227-.684.339-1.443.562-1.793.528-2.69.791-2.997 1.408-.1.201-.156.42-.164.645-.026.689.635 1.35 1.957 2.672l1.276 1.276 1.117 1.117 1.277 1.276c1.321 1.322 1.982 1.983 2.671 1.957a1.6 1.6 0 0 0 .645-.164c.617-.307.88-1.204 1.408-2.997.223-.76.335-1.138.563-1.442q.116-.156.26-.288c.279-.257.645-.406 1.377-.705l2.49-1.014c2.656-1.082 3.984-1.623 4.208-2.73.223-1.107-.79-2.121-2.818-4.149"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="m3.348 21.769 3.723-3.723-1.117-1.117-3.723 3.723a.79.79 0 1 0 1.117 1.117"
      opacity={0.5}
    />
  </svg>
)
export { PinFillIcon }

const GridFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 6.5c0-2.121 0-3.182.659-3.841S4.379 2 6.5 2s3.182 0 3.841.659S11 4.379 11 6.5s0 3.182-.659 3.841S8.621 11 6.5 11s-3.182 0-3.841-.659S2 8.621 2 6.5M13 17.5c0-2.121 0-3.182.659-3.841S15.379 13 17.5 13s3.182 0 3.841.659S22 15.379 22 17.5s0 3.182-.659 3.841S19.621 22 17.5 22s-3.182 0-3.841-.659S13 19.621 13 17.5"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M2 17.5c0-2.121 0-3.182.659-3.841S4.379 13 6.5 13s3.182 0 3.841.659S11 15.379 11 17.5s0 3.182-.659 3.841S8.621 22 6.5 22s-3.182 0-3.841-.659S2 19.621 2 17.5M13 6.5c0-2.121 0-3.182.659-3.841S15.379 2 17.5 2s3.182 0 3.841.659S22 4.379 22 6.5s0 3.182-.659 3.841S19.621 11 17.5 11s-3.182 0-3.841-.659S13 8.621 13 6.5"
    />
  </svg>
)
export { GridFillIcon }

const WaterfallFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 6.21c0-1.984 0-2.977.659-3.593S4.379 2 6.5 2s3.182 0 3.841.617C11 3.233 11 4.226 11 6.21V17.79c0 1.984 0 2.977-.659 3.593S8.621 22 6.5 22s-3.182 0-3.841-.617C2 20.767 2 19.774 2 17.79z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M13 15.4c0-2.074 0-3.111.659-3.756S15.379 11 17.5 11s3.182 0 3.841.644C22 12.29 22 13.326 22 15.4v2.2c0 2.074 0 3.111-.659 3.756S19.621 22 17.5 22s-3.182 0-3.841-.644C13 20.71 13 19.674 13 17.6zM13 5.5c0-1.087 0-1.63.171-2.06a2.3 2.3 0 0 1 1.218-1.262C14.802 2 15.327 2 16.375 2h2.25c1.048 0 1.573 0 1.986.178.551.236.99.69 1.218 1.262.171.43.171.973.171 2.06s0 1.63-.171 2.06a2.3 2.3 0 0 1-1.218 1.262C20.198 9 19.673 9 18.625 9h-2.25c-1.048 0-1.573 0-1.986-.178a2.3 2.3 0 0 1-1.218-1.262C13 7.13 13 6.587 13 5.5"
    />
  </svg>
)
export { WaterfallFillIcon }

const RiverFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M13 15.4c0-2.074 0-3.111.659-3.756S15.379 11 17.5 11s3.182 0 3.841.644C22 12.29 22 13.326 22 15.4v2.2c0 2.074 0 3.111-.659 3.756S19.621 22 17.5 22s-3.182 0-3.841-.644C13 20.71 13 19.674 13 17.6z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M2 8.6c0 2.074 0 3.111.659 3.756S4.379 13 6.5 13s3.182 0 3.841-.644C11 11.71 11 10.674 11 8.6V6.4c0-2.074 0-3.111-.659-3.756S8.621 2 6.5 2s-3.182 0-3.841.644C2 3.29 2 4.326 2 6.4zM13 5.5c0-1.087 0-1.63.171-2.06a2.3 2.3 0 0 1 1.218-1.262C14.802 2 15.327 2 16.375 2h2.25c1.048 0 1.573 0 1.986.178.551.236.99.69 1.218 1.262.171.43.171.973.171 2.06s0 1.63-.171 2.06a2.3 2.3 0 0 1-1.218 1.262C20.198 9 19.673 9 18.625 9h-2.25c-1.048 0-1.573 0-1.986-.178a2.3 2.3 0 0 1-1.218-1.262C13 7.13 13 6.587 13 5.5"
    />
    <path
      fill="currentColor"
      d="M2 18.5c0 1.087 0 1.63.171 2.06a2.3 2.3 0 0 0 1.218 1.262c.413.178.938.178 1.986.178h2.25c1.048 0 1.573 0 1.986-.178.551-.236.99-.69 1.218-1.262.171-.43.171-.973.171-2.06s0-1.63-.171-2.06a2.3 2.3 0 0 0-1.218-1.262C9.198 15 8.673 15 7.625 15h-2.25c-1.048 0-1.573 0-1.986.178-.551.236-.99.69-1.218 1.262C2 16.87 2 17.413 2 18.5"
      opacity={0.5}
    />
  </svg>
)
export { RiverFillIcon }

const RecentFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3.464 20.536C4.93 22 7.286 22 12 22s7.071 0 8.535-1.465C22 19.072 22 16.714 22 12s0-7.071-1.465-8.536C19.072 2 16.714 2 12 2S4.929 2 3.464 3.464C2 4.93 2 7.286 2 12s0 7.071 1.464 8.535"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 7.25a.75.75 0 0 1 .75.75v3.69l2.28 2.28a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1-.22-.53V8a.75.75 0 0 1 .75-.75"
      clipRule="evenodd"
    />
  </svg>
)
export { RecentFillIcon }

const CalendarFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M6.94 2c.416 0 .753.324.753.724v1.46c.668-.012 1.417-.012 2.26-.012h4.015c.842 0 1.591 0 2.259.013v-1.46c0-.4.337-.725.753-.725s.753.324.753.724V4.25c1.445.111 2.394.384 3.09 1.055.698.67.982 1.582 1.097 2.972L22 9H2v-.724c.116-1.39.4-2.302 1.097-2.972s1.645-.944 3.09-1.055V2.724c0-.4.337-.724.753-.724"
    />
    <path
      fill="currentColor"
      d="M22 14v-2c0-.839-.003-2.335-.016-3H2.01c-.013.665-.01 2.161-.01 3v2c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.772 22 14"
      opacity={0.5}
    />
  </svg>
)
export { CalendarFillIcon }

const MoveFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257C2 5.626 2 6.068 2 6.95v7.3l.006 1.5c.027 2.636.191 4.104 1.166 5.078C4.343 22 6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M9.316 11.394a.75.75 0 0 0-.882 1.213l2.26 1.643H2l.006 1.5h8.688l-2.26 1.643a.75.75 0 0 0 .882 1.214l4.125-3a.75.75 0 0 0 0-1.213z"
    />
  </svg>
)
export { MoveFillIcon }

const ListFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
export { ListFillIcon }

const SpreadSheetFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.718 7.215a.75.75 0 0 0-1.436-.43l-.74 2.465H7a.75.75 0 0 0 0 1.5h2.092l-.75 2.5H6a.75.75 0 1 0 0 1.5h1.892l-.61 2.034a.75.75 0 0 0 1.436.431l.74-2.465h3.434l-.61 2.034a.75.75 0 0 0 1.436.431l.74-2.465H17a.75.75 0 0 0 0-1.5h-2.092l.75-2.5H18a.75.75 0 0 0 0-1.5h-1.892l.61-2.035a.75.75 0 0 0-1.436-.43l-.74 2.465h-3.434zm2.374 3.535-.75 2.5H9.908l.75-2.5z"
      clipRule="evenodd"
    />
  </svg>
)
export { SpreadSheetFillIcon }

const PinItemFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="m12.95 8.595-.363-.357C11.07 6.746 10.31 5.999 9.487 6c-.27 0-.535.054-.782.158-.757.32-1.154 1.3-1.948 3.261l-.057.142c-.225.556-.338.834-.519 1.058-.137.17-.302.317-.488.433-.245.154-.538.236-1.124.4-.908.252-1.362.38-1.564.65-.15.2-.215.45-.184.696.042.333.376.66 1.043 1.317l1.017 1 1.045 1.026.018.018 1.027 1.009c.667.656 1.001.984 1.34 1.025.25.031.505-.034.709-.18.275-.199.403-.645.661-1.538.166-.575.25-.863.406-1.104q.18-.276.44-.48c.23-.178.512-.289 1.078-.51l.144-.056c1.995-.78 2.993-1.17 3.318-1.914a1.9 1.9 0 0 0 .16-.768c.002-.81-.758-1.556-2.276-3.048"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="m3.27 18.786 2.674-2.627-.018-.018-1.045-1.027-2.663 2.637a.723.723 0 0 0 0 1.035.753.753 0 0 0 1.053 0"
      opacity={0.5}
    />
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd" opacity={0.5}>
      <path d="M22 8.377a.74.74 0 0 1-.744.731h-4.962a.74.74 0 0 1-.744-.731c0-.404.333-.731.744-.731h4.962c.411 0 .744.327.744.731M22 12.766a.74.74 0 0 1-.744.731h-3.97a.74.74 0 0 1-.744-.731c0-.404.333-.732.744-.732h3.97c.411 0 .744.328.744.732M22 17.155a.74.74 0 0 1-.744.731h-8.932a.74.74 0 0 1-.744-.731c0-.404.333-.732.744-.732h8.932c.411 0 .744.328.744.732" />
    </g>
  </svg>
)
export { PinItemFillIcon }

const AddFoldersIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M22 13.75v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225c-.855-.769-2.172-.769-4.804-.769h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352c-.488-.271-.896-.68-1.712-1.495l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903c-.186-.017-.38-.017-.766-.017-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.007C2 5.376 2 5.818 2 6.7v7.05c0 3.771 0 5.657 1.172 6.828S6.229 21.75 10 21.75h4c3.771 0 5.657 0 6.828-1.172S22 17.521 22 13.75"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M12 11a.75.75 0 0 1 .75.75V13H14a.75.75 0 0 1 0 1.5h-1.25v1.25a.75.75 0 0 1-1.5 0V14.5H10a.75.75 0 0 1 0-1.5h1.25v-1.25A.75.75 0 0 1 12 11"
    />
  </svg>
)
export { AddFoldersIcon }

const UploadFolderFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    {...props}
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M22 13.75v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225c-.855-.769-2.172-.769-4.804-.769h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352c-.488-.271-.896-.68-1.712-1.495l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903c-.186-.017-.38-.017-.766-.017-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.007C2 5.376 2 5.818 2 6.7v7.05c0 3.771 0 5.657 1.172 6.828S6.229 21.75 10 21.75h4c3.771 0 5.657 0 6.828-1.172S22 17.521 22 13.75"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M7.987 12.953a.75.75 0 0 1 1.026 0l2 1.875a.75.75 0 0 1-1.026 1.094l-.737-.69V18.5a.75.75 0 0 1-1.5 0v-3.269l-.737.691a.75.75 0 0 1-1.026-1.094zM11.51 2.26l-.01 2.835"
    />
  </svg>
)
export { UploadFolderFillIcon }

const UploadFileFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-.437c0-.873 0-1.529-.043-2.063h-4.052c-1.097 0-2.067 0-2.848-.105-.847-.114-1.694-.375-2.385-1.066-.692-.692-.953-1.539-1.067-2.386-.105-.781-.105-1.75-.105-2.848l.01-2.834q0-.124.02-.244C11.121 2 10.636 2 10.03 2 6.239 2 4.343 2 3.172 3.172 2 4.343 2 6.229 2 10v4c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M7.987 12.953a.75.75 0 0 1 1.026 0l2 1.875a.75.75 0 0 1-1.026 1.094l-.737-.69V18.5a.75.75 0 0 1-1.5 0v-3.269l-.737.691a.75.75 0 0 1-1.026-1.094zM11.51 2.26l-.01 2.835c0 1.097 0 2.066.105 2.848.114.847.375 1.694 1.067 2.385.69.691 1.538.953 2.385 1.067.781.105 1.751.105 2.848.105h4.052q.02.232.028.5H22c0-.268 0-.402-.01-.56a5.3 5.3 0 0 0-.958-2.641c-.094-.128-.158-.204-.285-.357C19.954 7.494 18.91 6.312 18 5.5c-.81-.724-1.921-1.515-2.89-2.161-.832-.556-1.248-.834-1.819-1.04a6 6 0 0 0-.506-.154c-.384-.095-.758-.128-1.285-.14z"
    />
  </svg>
)
export { UploadFileFillIcon }

const ZoomInFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M12 8.25a.75.75 0 0 1 .75.75v2.25H15a.75.75 0 0 1 0 1.5h-2.25V15a.75.75 0 0 1-1.5 0v-2.25H9a.75.75 0 0 1 0-1.5h2.25V9a.75.75 0 0 1 .75-.75"
    />
  </svg>
)
export { ZoomInFillIcon }

const ZoomOutFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M15 12.75a.75.75 0 0 0 0-1.5H9a.75.75 0 0 0 0 1.5z"
    />
  </svg>
)
export { ZoomOutFillIcon }

const MinimizeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.47 17.53a.75.75 0 0 1 0-1.06l2.22-2.22H7.5a.75.75 0 0 1 0-1.5h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-1.19l-2.22 2.22a.75.75 0 0 1-1.06 0M17.25 10.5a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 1.5 0v1.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-2.22 2.22h1.19a.75.75 0 0 1 .75.75"
      clipRule="evenodd"
    />
  </svg>
)
export { MinimizeFillIcon }

const CameraFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 22c-4.714 0-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 7.25a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5m0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5"
      clipRule="evenodd"
    />
  </svg>
)
export { CameraFillIcon }

const SkipPreviousFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10.3 6.837C7.433 9.029 6 10.125 6 12s1.433 2.97 4.3 5.163a41 41 0 0 0 2.297 1.65c.633.416 1.35.847 2.091 1.27 2.86 1.63 4.29 2.446 5.572 1.543 1.283-.902 1.4-2.792 1.632-6.57.066-1.07.108-2.117.108-3.056s-.042-1.987-.108-3.055c-.233-3.78-.35-5.668-1.632-6.571s-2.712-.087-5.572 1.543a39 39 0 0 0-2.091 1.27 41 41 0 0 0-2.297 1.65"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 4.25a.75.75 0 0 0-.75.75v15a.75.75 0 0 0 1.5 0V5A.75.75 0 0 0 2 4.25"
      clipRule="evenodd"
      opacity={0.5}
    />
  </svg>
)
export { SkipPreviousFillIcon }

const RepeatFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M8.716 3.203a.7.7 0 0 1 .987 0l1.86 1.846c.2.198.26.496.151.754a.7.7 0 0 1-.644.428H9.21C5.997 6.23 3.394 8.814 3.394 12S6 17.77 9.21 17.77h.464c.386 0 .698.31.698.692a.695.695 0 0 1-.698.692H9.21C5.228 19.154 2 15.95 2 12s3.228-7.154 7.21-7.154h.175l-.669-.664a.69.69 0 0 1 0-.98M13.628 5.538c0-.382.312-.692.698-.692h.465C18.772 4.846 22 8.05 22 12s-3.228 7.154-7.21 7.154h-.175l.669.664a.69.69 0 0 1 0 .98.7.7 0 0 1-.987 0l-1.86-1.847a.69.69 0 0 1-.151-.754.7.7 0 0 1 .644-.428h1.86c3.212 0 5.815-2.583 5.815-5.769s-2.603-5.77-5.814-5.77h-.465a.695.695 0 0 1-.698-.692"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M5.488 12c0-2.04 1.666-3.692 3.721-3.692h5.582c2.055 0 3.72 1.653 3.72 3.692s-1.665 3.692-3.72 3.692H9.209c-2.055 0-3.72-1.653-3.72-3.692"
      opacity={0.5}
    />
  </svg>
)
export { RepeatFillIcon }

const ShuffleFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 16.25a.75.75 0 0 0 0 1.5zm8.748-2.163-.643-.386zm2.504-4.174.643.386zM22 7l.53.53a.75.75 0 0 0 0-1.06zm-2.53 1.47a.75.75 0 0 0 1.06 1.06zm1.06-4a.75.75 0 1 0-1.06 1.06zm-5.31 2.92-.369-.653zM2 17.75h3.603v-1.5H2zm9.39-3.277 2.505-4.174-1.286-.772-2.504 4.174zm7.007-6.723H22v-1.5h-3.603zm3.073-1.28-2 2 1.06 1.06 2-2zm1.06 0-2-2-1.06 1.06 2 2zm-8.635 3.829c.434-.724.734-1.22 1.006-1.589.263-.355.468-.543.689-.668l-.739-1.305c-.467.264-.82.627-1.155 1.08-.326.44-.668 1.011-1.087 1.71zm4.502-4.049c-.815 0-1.48 0-2.025.052-.562.055-1.054.17-1.521.435l.739 1.305c.22-.125.487-.204.927-.247.456-.044 1.036-.045 1.88-.045zM5.603 17.75c.815 0 1.48 0 2.025-.052.562-.055 1.054-.17 1.521-.435l-.739-1.305c-.22.125-.487.204-.927.247-.456.044-1.036.045-1.88.045zm4.502-4.049c-.435.724-.734 1.22-1.006 1.589-.263.355-.468.543-.689.668l.74 1.305c.466-.264.819-.627 1.154-1.08.326-.44.668-1.011 1.087-1.71z"
    />
    <path
      fill="currentColor"
      d="M2 7.75a.75.75 0 0 1 0-1.5zm8.748 2.163-.643.386zm2.504 4.174.643-.386zM22 17l.53-.53a.75.75 0 0 1 0 1.06zm-2.53-1.47a.75.75 0 1 1 1.06-1.06zm1.06 4a.75.75 0 1 1-1.06-1.06zm-5.31-2.92-.369.653zM2 6.25h3.603v1.5H2zm9.39 3.277 2.505 4.174-1.286.772-2.504-4.174zm7.007 6.723H22v1.5h-3.603zm3.073 1.28-2-2 1.06-1.06 2 2zm1.06 0-2 2-1.06-1.06 2-2zm-8.635-3.829c.434.724.734 1.22 1.006 1.589.263.355.468.543.689.668l-.739 1.305c-.467-.264-.82-.627-1.155-1.08-.326-.44-.668-1.011-1.087-1.71zm4.502 4.049c-.815 0-1.48 0-2.025-.052-.562-.055-1.054-.17-1.521-.435l.739-1.305c.22.125.487.204.927.247.456.044 1.036.045 1.88.045zM5.603 6.25c.815 0 1.48 0 2.025.052.562.055 1.054.17 1.521.435L8.41 8.042c-.22-.125-.487-.204-.927-.247-.456-.044-1.036-.045-1.88-.045zm4.502 4.049c-.435-.724-.734-1.22-1.006-1.589-.263-.355-.468-.543-.689-.668l.74-1.305c.466.264.819.627 1.154 1.08.326.44.668 1.011 1.087 1.71z"
      opacity={0.5}
    />
  </svg>
)
export { ShuffleFillIcon }

const VolumeFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2.003 11.716c.037-1.843.056-2.764.668-3.552.112-.144.276-.315.413-.431.752-.636 1.746-.636 3.733-.636.71 0 1.065 0 1.403-.092q.105-.03.209-.067c.33-.121.627-.33 1.22-.746 2.338-1.645 3.508-2.467 4.489-2.11.188.069.37.168.533.29.848.635.913 2.115 1.042 5.073.048 1.096.08 2.034.08 2.555s-.032 1.46-.08 2.555c-.13 2.958-.194 4.438-1.042 5.073-.163.122-.345.221-.533.29-.982.357-2.15-.465-4.49-2.11-.592-.416-.889-.625-1.22-.746a3 3 0 0 0-.208-.067c-.338-.092-.693-.092-1.403-.092-1.987 0-2.98 0-3.733-.636a3 3 0 0 1-.413-.43c-.612-.79-.63-1.71-.668-3.552a14 14 0 0 1 0-.57"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M19.49 5.552a.66.66 0 0 1 .97.094l-.529.471.53-.47h.001l.001.002.003.004.007.009.079.112q.073.107.186.305c.149.265.34.652.527 1.171C21.64 8.291 22 9.851 22 12s-.36 3.71-.735 4.75c-.188.52-.378.907-.527 1.172a5 5 0 0 1-.265.417l-.007.009-.003.003-.001.002s-.001.001-.53-.47l.529.471a.66.66 0 0 1-.971.094.77.77 0 0 1-.092-1.03l.003-.005.028-.04q.043-.062.126-.208a6 6 0 0 0 .422-.943c.314-.871.644-2.252.644-4.222 0-1.969-.33-3.35-.644-4.222a6 6 0 0 0-.422-.942 3 3 0 0 0-.157-.252"
      clipRule="evenodd"
      opacity={0.4}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.757 8.416c.333-.197.753-.07.938.286l-.603.357.603-.357.001.002.002.003.003.007.01.018.024.053q.028.063.07.17c.053.145.12.35.185.62.13.54.252 1.337.252 2.425 0 1.089-.122 1.886-.252 2.426-.065.27-.132.475-.186.619a3 3 0 0 1-.094.223l-.009.018-.003.007-.002.003v.002s-.001.001-.604-.356l.603.357c-.185.355-.605.483-.938.286-.33-.196-.45-.638-.272-.991l.004-.01.035-.085c.032-.086.08-.23.13-.438.1-.416.208-1.09.208-2.06 0-.971-.108-1.645-.208-2.061a4 4 0 0 0-.165-.523l-.004-.01c-.179-.354-.058-.796.272-.991"
      clipRule="evenodd"
      opacity={0.7}
    />
  </svg>
)
export { VolumeFillIcon }

const MutedillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M17.782 9.52a.745.745 0 0 1 1.048 0l1.452 1.44 1.453-1.44a.745.745 0 0 1 1.048 0c.29.286.29.752 0 1.04L21.33 12l1.453 1.441c.29.287.29.753 0 1.04a.745.745 0 0 1-1.048 0l-1.453-1.44-1.452 1.44a.745.745 0 0 1-1.048 0 .73.73 0 0 1 0-1.04l1.452-1.44-1.452-1.442a.73.73 0 0 1 0-1.04"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M2.003 11.716c.04-1.843.06-2.764.718-3.552.12-.144.296-.315.444-.431.809-.636 1.876-.636 4.012-.636.763 0 1.144 0 1.508-.092q.114-.03.224-.067c.355-.121.674-.33 1.31-.746 2.514-1.645 3.771-2.467 4.826-2.11.202.069.398.168.573.29.911.635.98 2.115 1.12 5.073.05 1.096.085 2.034.085 2.555s-.034 1.46-.086 2.555c-.138 2.958-.208 4.438-1.12 5.073-.174.122-.37.221-.572.29-1.055.357-2.312-.465-4.825-2.11-.637-.416-.956-.625-1.31-.746a3 3 0 0 0-.225-.067c-.364-.092-.745-.092-1.508-.092-2.136 0-3.203 0-4.012-.636a3.3 3.3 0 0 1-.444-.43c-.658-.79-.678-1.71-.718-3.552a13 13 0 0 1 0-.57"
      opacity={0.5}
    />
  </svg>
)
export { MutedillIcon }

const Forward10FillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10.325 7.824a.75.75 0 0 1 .425.676v7a.75.75 0 0 1-1.5 0v-5.44l-1.281 1.026a.75.75 0 0 1-.937-1.172l2.5-2a.75.75 0 0 1 .793-.09"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.25 7.75a2.5 2.5 0 0 0-2.5 2.5v3.5a2.5 2.5 0 0 0 5 0v-3.5a2.5 2.5 0 0 0-2.5-2.5m0 1.5a1 1 0 0 0-1 1v3.5a1 1 0 1 0 2 0v-3.5a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.676 1.675A.75.75 0 0 0 12 1.25q-1.104.002-2.15.215C4.945 2.461 1.25 6.798 1.25 12c0 5.937 4.813 10.75 10.75 10.75S22.75 17.937 22.75 12c0-4.41-2.655-8.197-6.45-9.855a.75.75 0 0 0-.6 1.374A9.25 9.25 0 1 1 2.75 12a9.255 9.255 0 0 1 6.5-8.834V4.5a.75.75 0 0 0 1.336.469l2-2.5a.75.75 0 0 0 .09-.794"
      clipRule="evenodd"
      opacity={0.5}
    />
  </svg>
)
export { Forward10FillIcon }

const Previous10FillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10.325 7.824a.75.75 0 0 1 .425.676v7a.75.75 0 0 1-1.5 0v-5.44l-1.281 1.026a.75.75 0 0 1-.937-1.172l2.5-2a.75.75 0 0 1 .793-.09"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.25 7.75a2.5 2.5 0 0 0-2.5 2.5v3.5a2.5 2.5 0 0 0 5 0v-3.5a2.5 2.5 0 0 0-2.5-2.5m0 1.5a1 1 0 0 0-1 1v3.5a1 1 0 1 0 2 0v-3.5a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.324 1.675A.75.75 0 0 1 12 1.25q1.104.002 2.15.215c4.906.996 8.6 5.333 8.6 10.535 0 5.937-4.813 10.75-10.75 10.75S1.25 17.937 1.25 12c0-4.41 2.655-8.197 6.45-9.855a.75.75 0 1 1 .6 1.374A9.25 9.25 0 1 0 21.25 12a9.255 9.255 0 0 0-6.5-8.834V4.5a.75.75 0 0 1-1.336.469l-2-2.5a.75.75 0 0 1-.09-.794"
      clipRule="evenodd"
      opacity={0.5}
    />
  </svg>
)
export { Previous10FillIcon }

const FullscreenFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M18.29 2.89c-1.028-.138-2.383-.14-4.29-.14a.75.75 0 0 1 0-1.5h.056c1.838 0 3.294 0 4.433.153 1.172.158 2.121.49 2.87 1.238.748.749 1.08 1.698 1.238 2.87.153 1.14.153 2.595.153 4.433V10a.75.75 0 0 1-1.5 0c0-1.907-.002-3.261-.14-4.29-.135-1.005-.389-1.585-.812-2.008s-1.003-.677-2.009-.812M2 13.25a.75.75 0 0 1 .75.75c0 1.907.002 3.262.14 4.29.135 1.005.389 1.585.812 2.008s1.003.677 2.009.812c1.028.138 2.382.14 4.289.14a.75.75 0 0 1 0 1.5h-.056c-1.838 0-3.294 0-4.433-.153-1.172-.158-2.121-.49-2.87-1.238-.748-.749-1.08-1.698-1.238-2.87-.153-1.14-.153-2.595-.153-4.433V14a.75.75 0 0 1 .75-.75"
      clipRule="evenodd"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M9.944 1.25H10a.75.75 0 0 1 0 1.5c-1.907 0-3.261.002-4.29.14-1.005.135-1.585.389-2.008.812S3.025 4.705 2.89 5.71C2.752 6.739 2.75 8.093 2.75 10a.75.75 0 0 1-1.5 0v-.056c0-1.838 0-3.294.153-4.433.158-1.172.49-2.121 1.238-2.87.749-.748 1.698-1.08 2.87-1.238 1.14-.153 2.595-.153 4.433-.153M22 13.25a.75.75 0 0 1 .75.75v.056c0 1.838 0 3.294-.153 4.433-.158 1.172-.49 2.121-1.238 2.87-.749.748-1.698 1.08-2.87 1.238-1.14.153-2.595.153-4.433.153H14a.75.75 0 0 1 0-1.5c1.907 0 3.262-.002 4.29-.14 1.005-.135 1.585-.389 2.008-.812s.677-1.003.812-2.009c.138-1.027.14-2.382.14-4.289a.75.75 0 0 1 .75-.75" />
    </g>
  </svg>
)
export { FullscreenFillIcon }

const QuitFullscreenFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M10 1.25a.75.75 0 0 1 .75.75v.056c0 1.838 0 3.294-.153 4.433-.158 1.172-.49 2.121-1.238 2.87-.749.748-1.698 1.08-2.87 1.238-1.14.153-2.595.153-4.433.153H2a.75.75 0 0 1 0-1.5c1.907 0 3.261-.002 4.29-.14 1.005-.135 1.585-.389 2.008-.812s.677-1.003.812-2.009c.138-1.028.14-2.382.14-4.289a.75.75 0 0 1 .75-.75m11.944 12H22a.75.75 0 0 1 0 1.5c-1.907 0-3.262.002-4.29.14-1.005.135-1.585.389-2.008.812s-.677 1.003-.812 2.009c-.138 1.027-.14 2.382-.14 4.289a.75.75 0 0 1-1.5 0v-.056c0-1.838 0-3.294.153-4.433.158-1.172.49-2.121 1.238-2.87.749-.748 1.698-1.08 2.87-1.238 1.14-.153 2.595-.153 4.433-.153"
      clipRule="evenodd"
    />
    <g fill="currentColor" opacity={0.5}>
      <path d="M14 1.25a.75.75 0 0 1 .75.75c0 1.907.002 3.261.14 4.29.135 1.005.389 1.585.812 2.008s1.003.677 2.009.812c1.027.138 2.382.14 4.289.14a.75.75 0 0 1 0 1.5h-.056c-1.838 0-3.294 0-4.433-.153-1.172-.158-2.121-.49-2.87-1.238-.748-.749-1.08-1.698-1.238-2.87-.153-1.14-.153-2.595-.153-4.433V2a.75.75 0 0 1 .75-.75M1.25 14a.75.75 0 0 1 .75-.75h.056c1.838 0 3.294 0 4.433.153 1.172.158 2.121.49 2.87 1.238.748.749 1.08 1.698 1.238 2.87.153 1.14.153 2.595.153 4.433V22a.75.75 0 0 1-1.5 0c0-1.907-.002-3.262-.14-4.29-.135-1.005-.389-1.585-.812-2.008s-1.003-.677-2.009-.812c-1.028-.138-2.382-.14-4.289-.14a.75.75 0 0 1-.75-.75" />
    </g>
  </svg>
)
export { QuitFullscreenFillIcon }

const ItemPanelFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M3.172 4.171C2 5.343 2 7.23 2 11v2c0 3.771 0 5.657 1.172 6.828S6.229 21 10 21h5V3h-5C6.229 3 4.343 3 3.172 4.17"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M5.5 9.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5zM6.5 13.25a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5zM22 13v-2c0-3.771 0-5.657-1.172-6.828-.974-.975-3.192-1.139-5.828-1.166v17.988c2.636-.027 4.854-.191 5.828-1.166C22 18.657 22 16.771 22 13"
    />
  </svg>
)
export { ItemPanelFillIcon }

const OutlineFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3 10c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h2c3.771 0 5.657 0 6.828 1.172S21 6.229 21 10v4c0 3.771 0 5.657-1.172 6.828S16.771 22 13 22h-2c-3.771 0-5.657 0-6.828-1.172S3 17.771 3 14z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.25 10A.75.75 0 0 1 8 9.25h8a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75M7.25 14a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75"
      clipRule="evenodd"
    />
  </svg>
)
export { OutlineFillIcon }

const TogglePdfPagesFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <g fill="currentColor" opacity={0.5}>
      <path d="M8 5.5h8a3 3 0 0 0 3-3 .5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5 3 3 0 0 0 3 3M16 18.5H8a3 3 0 0 0-3 3 .5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5 3 3 0 0 0-3-3" />
    </g>
    <path
      fill="currentColor"
      d="M5 11.5c0-1.886 0-2.828.586-3.414S7.114 7.5 9 7.5h6c1.886 0 2.828 0 3.414.586S19 9.614 19 11.5v1c0 1.886 0 2.828-.586 3.414S16.886 16.5 15 16.5H9c-1.886 0-2.828 0-3.414-.586S5 14.386 5 12.5z"
    />
  </svg>
)
export { TogglePdfPagesFillIcon }

const BoxFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M8.422 20.618C10.178 21.54 11.056 22 12 22V12L2.638 7.073l-.04.067C2 8.154 2 9.417 2 11.942v.117c0 2.524 0 3.787.597 4.801.598 1.015 1.674 1.58 3.825 2.709z"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="m17.577 4.432-2-1.05C13.822 2.461 12.944 2 12 2c-.945 0-1.822.46-3.578 1.382l-2 1.05C4.318 5.536 3.242 6.1 2.638 7.072L12 12l9.362-4.927c-.606-.973-1.68-1.537-3.785-2.641"
    />
    <path
      fill="currentColor"
      d="m21.403 7.14-.041-.067L12 12v10c.944 0 1.822-.46 3.578-1.382l2-1.05c2.151-1.129 3.227-1.693 3.825-2.708C22 15.846 22 14.583 22 12.06v-.117c0-2.525 0-3.788-.597-4.802"
      opacity={0.5}
    />
  </svg>
)
export { BoxFillIcon }

const TagFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M4.728 16.137c-1.545-1.546-2.318-2.318-2.605-3.321-.288-1.003-.042-2.068.45-4.197l.283-1.228c.413-1.792.62-2.688 1.233-3.302s1.51-.82 3.302-1.233l1.228-.284c2.13-.491 3.194-.737 4.197-.45 1.003.288 1.775 1.061 3.32 2.606l1.83 1.83C20.657 9.248 22 10.592 22 12.262c0 1.671-1.344 3.015-4.033 5.704-2.69 2.69-4.034 4.034-5.705 4.034-1.67 0-3.015-1.344-5.704-4.033z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M10.124 7.271a2.017 2.017 0 1 1-2.853 2.852 2.017 2.017 0 0 1 2.853-2.852M19.051 12.051l-6.979 6.98a.75.75 0 1 1-1.06-1.06l6.979-6.98a.75.75 0 1 1 1.06 1.06"
    />
  </svg>
)
export { TagFillIcon }

const UserFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="currentColor" d="M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
    <path
      fill="currentColor"
      d="M12 21c3.866 0 7-1.79 7-4s-3.134-4-7-4-7 1.79-7 4 3.134 4 7 4"
      opacity={0.5}
    />
  </svg>
)
export { UserFillIcon }

const UndoIcon = (props: SVGProps<SVGSVGElement>) => (
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
      strokeWidth={1.6}
      d="M8 7H5.5V4.5M5.7 7A8 8 0 1 1 4 12"
    />
  </svg>
)
export { UndoIcon }

const InvitationEmptyFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M1 12c0-5.185 0-7.778 1.61-9.39C4.223 1 6.816 1 12 1s7.778 0 9.39 1.61C23 4.223 23 6.816 23 12s0 7.778-1.61 9.39C19.777 23 17.184 23 12 23s-7.778 0-9.39-1.61C1 19.777 1 17.184 1 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M2.61 21.389c1.612 1.61 4.205 1.61 9.39 1.61s7.778 0 9.39-1.61c1.492-1.493 1.601-3.829 1.61-8.29h-3.476c-.996 0-1.494 0-1.931.202-.438.201-.762.58-1.41 1.335l-.666.777c-.648.756-.972 1.134-1.41 1.335s-.935.202-1.93.202h-.353c-.996 0-1.494 0-1.931-.202-.438-.2-.762-.579-1.41-1.335l-.666-.777c-.648-.756-.972-1.134-1.41-1.335s-.935-.201-1.93-.201H1c.008 4.46.118 6.796 1.61 8.289"
    />
  </svg>
)
export { InvitationEmptyFillIcon }

const InboxUnreadFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="currentColor" d="M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
    <path
      fill="currentColor"
      d="M15.612 2.038C14.59 2 13.399 2 12 2 7.286 2 4.929 2 3.464 3.464 2 4.93 2 7.286 2 12s0 7.071 1.464 8.535C4.93 22 7.286 22 12 22s7.071 0 8.535-1.465C22 19.072 22 16.714 22 12c0-1.399 0-2.59-.038-3.612a4.5 4.5 0 0 1-6.35-6.35"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M3.465 20.536C4.929 22 7.286 22 12 22s7.072 0 8.536-1.465C21.893 19.179 21.993 17.056 22 13h-3.16c-.905 0-1.358 0-1.755.183-.398.183-.693.527-1.282 1.214l-.605.706c-.59.687-.884 1.031-1.282 1.214s-.85.183-1.755.183h-.321c-.905 0-1.358 0-1.756-.183s-.692-.527-1.281-1.214l-.606-.706c-.589-.687-.883-1.031-1.281-1.214S6.066 13 5.16 13H2c.007 4.055.107 6.179 1.465 7.535"
    />
  </svg>
)
export { InboxUnreadFillIcon }

const InboxFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M3.465 20.536C4.929 22 7.286 22 12 22s7.072 0 8.536-1.465C21.893 19.179 21.993 17.056 22 13h-3.16c-.905 0-1.358 0-1.755.183-.398.183-.693.527-1.282 1.214l-.605.706c-.59.687-.884 1.031-1.282 1.214s-.85.183-1.755.183h-.321c-.905 0-1.358 0-1.756-.183s-.692-.527-1.281-1.214l-.606-.706c-.589-.687-.883-1.031-1.281-1.214S6.066 13 5.16 13H2c.007 4.055.107 6.179 1.465 7.535M8 6.25a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5zM10 9.75a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5z"
    />
  </svg>
)
export { InboxFillIcon }

const InboxReciveFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    {...props}
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M3.465 20.536C4.929 22 7.286 22 12 22s7.072 0 8.536-1.465C21.893 19.179 21.993 17.056 22 13h-3.16c-.905 0-1.358 0-1.755.183-.398.183-.693.527-1.282 1.214l-.605.706c-.59.687-.884 1.031-1.282 1.214s-.85.183-1.755.183h-.321c-.905 0-1.358 0-1.756-.183s-.692-.527-1.281-1.214l-.606-.706c-.589-.687-.883-1.031-1.281-1.214S6.066 13 5.16 13H2c.007 4.055.107 6.179 1.465 7.535m9.065-9.205a.75.75 0 0 1-1.06 0l-3.3-3.3a.75.75 0 1 1 1.06-1.06l2.02 2.02V2h1.5v6.99l2.02-2.02a.75.75 0 1 1 1.06 1.06z"
    />
  </svg>
)
export { InboxReciveFillIcon }

const InboxSentFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M3.465 20.536C4.929 22 7.286 22 12 22s7.072 0 8.536-1.465C21.893 19.179 21.993 17.056 22 13h-3.16c-.905 0-1.358 0-1.755.183-.398.183-.693.527-1.282 1.214l-.605.706c-.59.687-.884 1.031-1.282 1.214s-.85.183-1.755.183h-.321c-.905 0-1.358 0-1.756-.183s-.692-.527-1.281-1.214l-.606-.706c-.589-.687-.883-1.031-1.281-1.214S6.066 13 5.16 13H2c.007 4.055.107 6.179 1.465 7.535"
    />
    <path
      fill="currentColor"
      d="M12.53 5.97a.75.75 0 0 0-1.06 0l-3.3 3.3a.75.75 0 1 0 1.06 1.06l2.02-2.02v8.187c-.534-.008-.865-.042-1.166-.18-.397-.183-.692-.527-1.281-1.214l-.606-.706c-.589-.687-.883-1.031-1.281-1.214S6.066 13 5.16 13H2c.007 4.055.107 6.179 1.465 7.535C4.929 22 7.286 22 12 22s7.072 0 8.536-1.465C21.893 19.179 21.993 17.056 22 13h-3.16c-.905 0-1.358 0-1.755.183-.398.183-.693.527-1.282 1.214l-.605.706c-.59.687-.884 1.031-1.282 1.214-.3.138-.632.172-1.166.18V8.311l2.02 2.02a.75.75 0 1 0 1.06-1.061z"
    />
  </svg>
)
export { InboxSentFillIcon }

const MessageFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M21.975 13.813A10.95 10.95 0 0 1 17 15C10.925 15 6 10.075 6 4q.001-.945.154-1.847c-.715.106-1.277.284-1.766.584a5 5 0 0 0-1.651 1.65C2 5.59 2 7.228 2 10.5v1c0 2.33 0 3.495.38 4.413a5 5 0 0 0 2.707 2.706c.66.274 1.447.35 2.703.372.85.015 1.275.022 1.613.219.337.196.548.552.968 1.262l.542.916c.483.816 1.69.816 2.174 0l.542-.916c.42-.71.63-1.066.968-1.262.338-.197.763-.204 1.613-.219 1.256-.021 2.043-.098 2.703-.372a5 5 0 0 0 2.706-2.706c.227-.547.319-1.182.356-2.1"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="m13.087 21.388.542-.916c.42-.71.63-1.066.968-1.262.338-.197.763-.204 1.613-.219 1.256-.021 2.043-.098 2.703-.372a5 5 0 0 0 2.706-2.706c.227-.547.319-1.182.356-2.1A10.95 10.95 0 0 1 17 15C10.925 15 6 10.075 6 4q.001-.945.154-1.847c-.715.106-1.277.284-1.766.584a5 5 0 0 0-1.651 1.65C2 5.59 2 7.228 2 10.5v1c0 2.33 0 3.495.38 4.413a5 5 0 0 0 2.707 2.706c.66.274 1.447.35 2.703.372.85.015 1.275.022 1.613.219.337.196.548.552.968 1.262l.542.916c.483.816 1.69.816 2.174 0"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M13.5 2h-3c-1.94 0-3.305 0-4.346.153Q6.001 3.055 6 4c0 6.075 4.925 11 11 11 1.79 0 3.48-.428 4.975-1.187C22 13.192 22 12.441 22 11.5v-1c0-3.273 0-4.91-.737-6.112a5 5 0 0 0-1.65-1.651C18.41 2 16.773 2 13.5 2"
      opacity={0.5}
    />
  </svg>
)
export { MessageFillIcon }

const NotificationFullFillIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox=" 0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M22 12c0 4.714 0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12s0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M7 16.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5zM7 13.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5zM22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
    />
  </svg>
)
export { NotificationFullFillIcon }

const NotificationEmptyFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M3.464 3.464C2 4.93 2 7.286 2 12s0 7.071 1.464 8.535l17.072-17.07C19.07 2 16.714 2 12 2S4.929 2 3.464 3.464"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M3.465 20.536C4.929 22 7.286 22 12 22s7.071 0 8.536-1.464C22 19.07 22 16.714 22 12s0-7.07-1.464-8.535z"
      opacity={0.5}
    />
  </svg>
)
export { NotificationEmptyFillIcon }

const SymbleOutlineFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      fillRule="evenodd"
      d="M3.172 4.171C2 5.343 2 7.23 2 11v2c0 3.771 0 5.657 1.172 6.828S6.229 21 10 21h5V3h-5C6.229 3 4.343 3 3.172 4.17"
      clipRule="evenodd"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M22 13v-2c0-3.771 0-5.657-1.172-6.828-.974-.975-3.192-1.139-5.828-1.166v17.988c2.636-.027 4.854-.191 5.828-1.166C22 18.657 22 16.771 22 13M9.263 13.298a.75.75 0 0 1 .44.965l-1.5 4a.75.75 0 1 1-1.405-.526l1.5-4a.75.75 0 0 1 .965-.44M6.53 13.47a.75.75 0 0 1 0 1.06l-.47.47.47.47a.75.75 0 1 1-1.06 1.06l-1-1a.75.75 0 0 1 0-1.06l1-1a.75.75 0 0 1 1.06 0M9.97 15.47a.75.75 0 0 1 1.06 0l1 1a.75.75 0 0 1 0 1.06l-1 1a.75.75 0 1 1-1.06-1.06l.47-.47-.47-.47a.75.75 0 0 1 0-1.06"
    />
  </svg>
)
export { SymbleOutlineFillIcon }

const RestoreFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M9.5 17.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C10.598 15 11.065 15 12 15s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75s0 1.402-.201 1.75a1.5 1.5 0 0 1-.549.549C13.402 20 12.935 20 12 20s-1.402 0-1.75-.201a1.5 1.5 0 0 1-.549-.549c-.201-.348-.201-.815-.201-1.75"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M17 17.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C18.098 15 18.565 15 19.5 15s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75s0 1.402-.201 1.75a1.5 1.5 0 0 1-.549.549c-.348.201-.815.201-1.75.201s-1.402 0-1.75-.201a1.5 1.5 0 0 1-.549-.549C17 18.902 17 18.435 17 17.5"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="M9.446 3.25c-1.133 0-2.058 0-2.79.098-.763.103-1.425.325-1.954.854s-.751 1.19-.854 1.955c-.098.73-.098 1.656-.098 2.79v6.059c-.465.014-.76.057-1 .195a1.5 1.5 0 0 0-.549.549C2 16.098 2 16.565 2 17.5s0 1.402.201 1.75a1.5 1.5 0 0 0 .549.549C3.098 20 3.565 20 4.5 20s1.402 0 1.75-.201a1.5 1.5 0 0 0 .549-.549C7 18.902 7 18.435 7 17.5s0-1.402-.201-1.75a1.5 1.5 0 0 0-.549-.549c-.24-.138-.535-.181-1-.195V9c0-1.2.002-2.024.085-2.643.08-.598.224-.89.428-1.094s.496-.348 1.094-.428C7.476 4.752 8.3 4.75 9.5 4.75h5c1.2 0 2.024.002 2.643.085.598.08.89.224 1.094.428s.348.496.428 1.094c.083.619.085 1.443.085 2.643v1.19l-.72-.72a.75.75 0 1 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72V8.945c0-1.133 0-2.058-.098-2.79-.103-.763-.325-1.425-.854-1.954s-1.19-.751-1.955-.854c-.73-.098-1.656-.098-2.79-.098z"
    />
  </svg>
)
export { RestoreFillIcon }

// Brand marks for the OAuth buttons, drawn in the set's solid style: squircle corners, full + 50% tones.
const MicrosoftFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12.5 6.75C12.5 4.511 12.5 3.391 13.196 2.696C13.891 2 15.011 2 17.25 2C19.489 2 20.609 2 21.304 2.696C22 3.391 22 4.511 22 6.75C22 8.989 22 10.109 21.304 10.804C20.609 11.5 19.489 11.5 17.25 11.5C15.011 11.5 13.891 11.5 13.196 10.804C12.5 10.109 12.5 8.989 12.5 6.75ZM12.5 17.25C12.5 15.011 12.5 13.891 13.196 13.196C13.891 12.5 15.011 12.5 17.25 12.5C19.489 12.5 20.609 12.5 21.304 13.196C22 13.891 22 15.011 22 17.25C22 19.489 22 20.609 21.304 21.304C20.609 22 19.489 22 17.25 22C15.011 22 13.891 22 13.196 21.304C12.5 20.609 12.5 19.489 12.5 17.25Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M2 6.75C2 4.511 2 3.391 2.696 2.696C3.391 2 4.511 2 6.75 2C8.989 2 10.109 2 10.804 2.696C11.5 3.391 11.5 4.511 11.5 6.75C11.5 8.989 11.5 10.109 10.804 10.804C10.109 11.5 8.989 11.5 6.75 11.5C4.511 11.5 3.391 11.5 2.696 10.804C2 10.109 2 8.989 2 6.75ZM2 17.25C2 15.011 2 13.891 2.696 13.196C3.391 12.5 4.511 12.5 6.75 12.5C8.989 12.5 10.109 12.5 10.804 13.196C11.5 13.891 11.5 15.011 11.5 17.25C11.5 19.489 11.5 20.609 10.804 21.304C10.109 22 8.989 22 6.75 22C4.511 22 3.391 22 2.696 21.304C2 20.609 2 19.489 2 17.25Z"
    />
  </svg>
)
export { MicrosoftFillIcon }

// Google G: the blue bar + lower arc solid, the rest of the ring at 50%.
const GoogleFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M19.071 4.929A10 10 0 1 0 19.071 19.071L16.596 16.596A6.5 6.5 0 1 1 16.596 7.404A1.75 1.75 0 0 0 19.071 4.929Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M16.596 16.596L19.071 19.071A10 10 0 0 0 22 12A1.75 1.75 0 0 0 20.25 10.25H13.75A1.75 1.75 0 0 0 13.75 13.75H18.26A6.5 6.5 0 0 1 16.596 16.596Z"
    />
  </svg>
)
export { GoogleFillIcon }

// GitHub: the official github.com Octocat path, scaled onto the set's squircle (50%).
const GithubFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M2 12C2 7.286 2 4.929 3.464 3.464C4.929 2 7.286 2 12 2C16.714 2 19.071 2 20.535 3.464C22 4.929 22 7.286 22 12C22 16.714 22 19.071 20.535 20.535C19.071 22 16.714 22 12 22C7.286 22 4.929 22 3.464 20.535C2 19.071 2 16.714 2 12Z"
      opacity={0.5}
    />
    <path
      fill="currentColor"
      d="M10.477 16.121C7.898 15.808 6.082 13.953 6.082 11.55C6.082 10.574 6.433 9.519 7.019 8.817C6.765 8.172 6.804 6.804 7.097 6.238C7.878 6.141 8.933 6.551 9.558 7.117C10.3 6.883 11.082 6.765 12.039 6.765C12.996 6.765 13.777 6.883 14.48 7.097C15.085 6.55 16.16 6.141 16.941 6.238C17.215 6.765 17.254 8.133 16.999 8.797C17.625 9.539 17.957 10.536 17.957 11.55C17.957 13.953 16.14 15.77 13.523 16.102C14.187 16.531 14.637 17.469 14.637 18.543L14.637 20.574L14.637 22L9.519 22L9.519 19.03A2.522 2.522 0 0 1 8.582 19.225C7.292 19.225 6.53 18.523 5.984 17.214C5.77 16.686 5.535 16.374 5.085 16.316C4.85 16.296 4.773 16.198 4.773 16.081C4.773 15.846 5.164 15.671 5.554 15.671C6.121 15.671 6.609 16.023 7.117 16.745C7.508 17.311 7.917 17.565 8.406 17.565C8.894 17.565 9.206 17.39 9.656 16.94C9.988 16.609 10.242 16.316 10.477 16.12Z"
    />
  </svg>
)
export { GithubFillIcon }

const AIFillIcon = (props: SVGProps<SVGSVGElement>) => (
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
      d="M7.453 5.713c.375-.95 1.72-.95 2.094 0l1.162 2.944c.114.29.344.52.634.634l2.944 1.162c.95.375.95 1.72 0 2.094l-2.944 1.162c-.29.114-.52.344-.634.634l-1.162 2.944c-.375.95-1.72.95-2.094 0L6.29 14.343a1.13 1.13 0 0 0-.634-.634l-2.944-1.162c-.95-.375-.95-1.72 0-2.094L5.657 9.29c.29-.114.52-.344.634-.634z"
    />
    <path
      fill="currentColor"
      d="M16.925 13.392a.619.619 0 0 1 1.15 0l.901 2.283c.063.16.19.286.349.349l2.283.9a.619.619 0 0 1 0 1.152l-2.283.9a.62.62 0 0 0-.349.349l-.9 2.283a.619.619 0 0 1-1.152 0l-.9-2.283a.62.62 0 0 0-.349-.349l-2.283-.9a.619.619 0 0 1 0-1.152l2.283-.9a.62.62 0 0 0 .349-.349z"
      opacity={0.7}
    />
    <path
      fill="currentColor"
      d="M17.04 3.213a.495.495 0 0 1 .92 0l.72 1.827c.051.128.152.229.28.279l1.827.72a.495.495 0 0 1 0 .921l-1.827.72a.5.5 0 0 0-.28.28l-.72 1.827a.495.495 0 0 1-.92 0l-.721-1.827a.5.5 0 0 0-.279-.28l-1.827-.72a.495.495 0 0 1 0-.92l1.827-.721a.5.5 0 0 0 .279-.279z"
      opacity={0.5}
    />
  </svg>
)
export { AIFillIcon }
