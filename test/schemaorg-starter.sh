#!/bin/bash

# Test the schema.org starter code.

. $(dirname $0)/common.sh
do_setup
trap on_error ERR INT TERM

# copy over the starting code
cp -r $srcdir/starter/schemaorg/* .

# get some fake restaurant data
mkdir -p source-data/restaurants/
wget https://almond-static.stanford.edu/test-data/schemaorg/restaurants/sample.json \
  -O source-data/restaurants/sample.json

starter_gen_and_train schemaorg restaurants custom_auto_annotate_flags="--batch-size 32"

# get some fake data to test with
cat > restaurants/eval/annotated.tsv <<EOF
1	i'm looking for a restaurant	now => @org.schema.Restaurant.Restaurant => notify
EOF

# evaluate
sed -i 's/restaurants_eval_models =/restaurants_eval_models = small/' Makefile
make experiment=restaurants eval_set=eval evaluate

rm -fr $workdir
