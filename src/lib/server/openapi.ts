import { version } from '../../../package.json';

export function generateOpenAPISpec() {
	return {
		openapi: '3.0.3',
		info: {
			title: 'Loggarr API',
			description: 'Docker log viewer API',
			version
		},
		servers: [{ url: '/' }],
		tags: [
			{ name: 'Health', description: 'Health check endpoints' },
			{ name: 'Containers', description: 'Docker container operations' },
			{ name: 'Logs', description: 'Log streaming operations' },
			{ name: 'Snapshots', description: 'Snapshot management' }
		],
		paths: {
			'/api/health': {
				get: {
					tags: ['Health'],
					summary: 'Health check',
					description: 'Check if the service is healthy and Docker socket is connected',
					responses: {
						'200': {
							description: 'Service is healthy',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } }
						},
						'503': {
							description: 'Service is unhealthy',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } }
						}
					}
				}
			},
			'/api/v1/containers': {
				get: {
					tags: ['Containers'],
					summary: 'List containers',
					description: 'Get a list of all Docker containers',
					responses: {
						'200': {
							description: 'List of containers',
							content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ContainerSummary' } } } }
						}
					}
				}
			},
			'/api/v1/logs': {
				get: {
					tags: ['Logs'],
					summary: 'Stream logs',
					description: 'Stream logs from Docker containers via Server-Sent Events (SSE)',
					parameters: [
						{ name: 'containers', in: 'query', description: 'Comma-separated container IDs to filter', schema: { type: 'string' } },
						{ name: 'levels', in: 'query', description: 'Comma-separated log levels to filter', schema: { type: 'string' } }
					],
					responses: {
						'200': {
							description: 'SSE stream of log entries',
							content: { 'text/event-stream': { schema: { type: 'string' } } }
						}
					}
				}
			},
			'/api/v1/snapshots': {
				get: {
					tags: ['Snapshots'],
					summary: 'List snapshots',
					description: 'Get a list of all saved snapshots',
					responses: {
						'200': {
							description: 'List of snapshots',
							content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SnapshotSummary' } } } }
						}
					}
				},
				post: {
					tags: ['Snapshots'],
					summary: 'Create snapshot',
					description: 'Save a new snapshot of log entries',
					requestBody: {
						required: true,
						content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSnapshotRequest' } } }
					},
					responses: {
						'201': {
							description: 'Snapshot created',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSnapshotResponse' } } }
						},
						'400': {
							description: 'Invalid request',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
						}
					}
				}
			},
			'/api/v1/snapshots/{id}': {
				get: {
					tags: ['Snapshots'],
					summary: 'Get snapshot',
					description: 'Get a specific snapshot by ID',
					parameters: [{ name: 'id', in: 'path', required: true, description: 'Snapshot ID', schema: { type: 'integer' } }],
					responses: {
						'200': {
							description: 'Snapshot details',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Snapshot' } } }
						},
						'404': {
							description: 'Snapshot not found',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
						}
					}
				},
				delete: {
					tags: ['Snapshots'],
					summary: 'Delete snapshot',
					description: 'Delete a snapshot by ID',
					parameters: [{ name: 'id', in: 'path', required: true, description: 'Snapshot ID', schema: { type: 'integer' } }],
					responses: {
						'200': {
							description: 'Snapshot deleted',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteSnapshotResponse' } } }
						},
						'404': {
							description: 'Snapshot not found',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
						}
					}
				}
			}
		},
		components: {
			schemas: {
				HealthResponse: {
					type: 'object',
					properties: {
						status: { type: 'string', enum: ['healthy', 'unhealthy'] },
						docker: { type: 'boolean' }
					},
					required: ['status', 'docker']
				},
				ContainerSummary: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						image: { type: 'string' },
						state: { type: 'string' },
						status: { type: 'string' }
					},
					required: ['id', 'name', 'image', 'state', 'status']
				},
				LogEntry: {
					type: 'object',
					properties: {
						timestamp: { type: 'string', format: 'date-time' },
						container: { type: 'string' },
						containerId: { type: 'string' },
						stream: { type: 'string', enum: ['stdout', 'stderr'] },
						message: { type: 'string' },
						level: { type: 'string', enum: ['debug', 'info', 'warning', 'error', 'alert'] }
					},
					required: ['timestamp', 'container', 'containerId', 'stream', 'message', 'level']
				},
				SnapshotSummary: {
					type: 'object',
					properties: {
						id: { type: 'integer' },
						name: { type: 'string' },
						createdAt: { type: 'string', format: 'date-time' }
					},
					required: ['id', 'name', 'createdAt']
				},
				Snapshot: {
					allOf: [
						{ $ref: '#/components/schemas/SnapshotSummary' },
						{
							type: 'object',
							properties: {
								logs: { type: 'array', items: { $ref: '#/components/schemas/LogEntry' } }
							},
							required: ['logs']
						}
					]
				},
				CreateSnapshotRequest: {
					type: 'object',
					properties: {
						name: { type: 'string', minLength: 1, maxLength: 255 },
						logs: { type: 'array', items: { $ref: '#/components/schemas/LogEntry' } }
					},
					required: ['name', 'logs']
				},
				CreateSnapshotResponse: {
					type: 'object',
					properties: {
						id: { type: 'integer' },
						name: { type: 'string' }
					},
					required: ['id', 'name']
				},
				DeleteSnapshotResponse: {
					type: 'object',
					properties: {
						success: { type: 'boolean' }
					},
					required: ['success']
				},
				ErrorResponse: {
					type: 'object',
					properties: {
						error: { type: 'string' }
					},
					required: ['error']
				}
			}
		}
	};
}
