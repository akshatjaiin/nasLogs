from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('collector', '0001_initial'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='costsnapshot',
            unique_together=set(),
        ),
    ]
