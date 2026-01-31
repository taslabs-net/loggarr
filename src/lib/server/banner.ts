export const banner = `
██╗      ██████╗  ██████╗  ██████╗  █████╗ ██████╗ ██████╗ 
██║     ██╔═══██╗██╔════╝ ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗
██║     ██║   ██║██║  ███╗██║  ███╗███████║██████╔╝██████╔╝
██║     ██║   ██║██║   ██║██║   ██║██╔══██║██╔══██╗██╔══██╗
███████╗╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║██║  ██║██║  ██║
╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
`;

export function printBanner(version: string, port: string, metricsPort: string): void {
	console.log(banner);
	console.log(`  v${version} | http://localhost:${port} | metrics :${metricsPort}`);
	console.log(`  https://github.com/taslabs-net/loggarr/releases/tag/v${version}`);
	console.log('');
}
