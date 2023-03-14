import { AskarModule } from '@aries-framework/askar'
import { ConsoleLogger, LogLevel, utils, KeyDerivationMethod, Agent } from '@aries-framework/core'
import { IndySdkModule } from '@aries-framework/indy-sdk'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar, Migration } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'
import indy from 'indy-sdk'
import { homedir } from 'os'

import { IndySdkToAskarMigrationUpdater } from '../src'

describe('Migrate', () => {
  const config = {
    label: 'test-agent',
    walletConfig: {
      id: `walletwallet.0-${utils.uuid()}`,
      key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
    logger: new ConsoleLogger(LogLevel.trace),
  }

  const oldAgent = new Agent({
    config,
    modules: { indySdk: new IndySdkModule({ indySdk: indy }) },
    dependencies: agentDependencies,
  })

  const newAgent = new Agent({
    config,
    modules: { askar: new AskarModule() },
    dependencies: agentDependencies,
  })

  const oldDbPath = `${homedir()}/.indy_client/wallet/${oldAgent.config.walletConfig?.id}/sqlite.db`

  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  // TODO: update with an aca-py issued revokable credential
  // community agent MIGHT have revocrevoc
  test('indy-sdk sqlite to aries-askar sqlite', async () => {
    const genericRecordContent = { foo: 'bar' }

    await oldAgent.initialize()

    const record = await oldAgent.genericRecords.save({ content: genericRecordContent })

    await oldAgent.shutdown()

    await Migration.migrate({
      walletName: config.walletConfig.id,
      walletKey: config.walletConfig.key,
      kdfLevel: config.walletConfig.keyDerivationMethod,
      specUri: oldDbPath,
    })

    const updater = await IndySdkToAskarMigrationUpdater.initialize({ dbPath: oldDbPath, agent: newAgent })
    await updater.update()

    await newAgent.initialize()

    await expect(newAgent.genericRecords.findById(record.id)).resolves.toMatchObject({ content: genericRecordContent })
  })
})